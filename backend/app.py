"""
Vox Backend — app.py
====================
Start:  python app.py
Then open: http://localhost:5000/test   <-- built-in test page to verify everything works

Install (one-time):
  pip install flask flask-cors ollama gtts pdfplumber python-docx Pillow
"""

import base64, io, os, sys, tempfile, traceback
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})   # allow React on :3000

# ── Which model to use ──────────────────────────────────────────────────
OLLAMA_MODEL       = "llama3"   # change if you use llama3.2, mistral, etc.
OLLAMA_VISION_MODEL = "llava"   # for image analysis (optional)

# ── Lazy imports with friendly errors ───────────────────────────────────
def _try(pkg):
    try: return __import__(pkg), None
    except ImportError as e: return None, str(e)

ollama_mod,   err_ollama  = _try("ollama")
gtts_mod,     err_gtts    = _try("gtts")
pdfplumber_mod,err_pdf    = _try("pdfplumber")
docx_mod,     err_docx    = _try("docx")
PIL_mod,      err_pil     = _try("PIL")

# ── Conversation history (per-session, simple list) ─────────────────────
_history: list[dict] = []

# ════════════════════════════════════════════════════════════════════════
#  HELPERS
# ════════════════════════════════════════════════════════════════════════

def ask_llm(user_prompt: str, system: str = "", use_history: bool = True) -> str:
    if ollama_mod is None:
        return f"⚠️ ollama package missing: {err_ollama}\nRun: pip install ollama"
    try:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        if use_history:
            messages += _history[-20:]          # last 10 exchanges
        messages.append({"role": "user", "content": user_prompt})

        response = ollama_mod.chat(model=OLLAMA_MODEL, messages=messages)
        reply = response["message"]["content"]

        if use_history:
            _history.append({"role": "user",      "content": user_prompt})
            _history.append({"role": "assistant",  "content": reply})
        return reply

    except Exception as e:
        tb = traceback.format_exc()
        # Common reason: Ollama server not running
        if "Connection refused" in str(e) or "connect" in str(e).lower():
            return (
                "⚠️ Cannot connect to Ollama.\n\n"
                "**Fix:** Open a terminal and run:\n```\nollama serve\n```\n"
                "Then make sure the model is pulled:\n```\nollama pull llama3\n```"
            )
        return f"⚠️ LLM error: {e}\n\n```\n{tb}\n```"


def extract_text_from_file(raw_bytes: bytes, filetype: str, filename: str) -> str:
    """Extract readable text from PDF, DOCX, or TXT bytes."""

    if filetype == "application/pdf":
        if pdfplumber_mod is None:
            return f"[pdfplumber not installed: {err_pdf}]"
        try:
            with pdfplumber_mod.open(io.BytesIO(raw_bytes)) as pdf:
                pages = []
                for i, page in enumerate(pdf.pages[:12]):   # max 12 pages
                    t = page.extract_text() or ""
                    if t.strip():
                        pages.append(f"--- Page {i+1} ---\n{t.strip()}")
                return "\n\n".join(pages) if pages else "[PDF has no readable text — may be scanned]"
        except Exception as e:
            return f"[PDF read error: {e}]"

    if filetype in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ):
        if docx_mod is None:
            return f"[python-docx not installed: {err_docx}]"
        try:
            from docx import Document
            doc = Document(io.BytesIO(raw_bytes))
            lines = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
            return "\n".join(lines) if lines else "[Empty Word document]"
        except Exception as e:
            return f"[DOCX read error: {e}]"

    if filetype in ("text/plain", "text/csv"):
        try:
            return raw_bytes.decode("utf-8", errors="replace")[:8000]
        except Exception as e:
            return f"[Text read error: {e}]"

    return f"[Unsupported file type: {filetype}]"


def analyse_image(raw_bytes: bytes, user_message: str) -> str:
    """Try llava for vision, fall back to text-only model."""
    if ollama_mod is None:
        return f"⚠️ ollama not available: {err_ollama}"

    b64 = base64.b64encode(raw_bytes).decode()

    # --- Try multimodal (llava / bakllava) ---
    try:
        msg = user_message or "Describe this image in detail. What do you see?"
        resp = ollama_mod.chat(
            model=OLLAMA_VISION_MODEL,
            messages=[{"role": "user", "content": msg, "images": [b64]}],
        )
        return resp["message"]["content"]
    except Exception as e:
        if "not found" in str(e).lower() or "pull" in str(e).lower():
            vision_note = (
                "*(llava model not found — for real image analysis run: `ollama pull llava`)*\n\n"
            )
        else:
            vision_note = f"*(llava error: {e})*\n\n"

    # --- Fall back: describe via text model ---
    prompt = (
        f"{vision_note}"
        f"The user uploaded an image and asked: \"{user_message or 'Please describe this image.'}\"\n\n"
        "Since I cannot see the image directly with this text model, please ask the user to "
        "describe what's in the image or to install the llava model for vision support."
    )
    return ask_llm(prompt, use_history=False)


# ════════════════════════════════════════════════════════════════════════
#  ROUTES
# ════════════════════════════════════════════════════════════════════════

@app.route("/", methods=["GET"])
def home():
    return jsonify({"status": "Vox backend running ✓", "model": OLLAMA_MODEL})


@app.route("/test", methods=["GET"])
def test_page():
    """Quick HTML test page — open http://localhost:5000/test in browser."""
    html = """<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Vox Backend Test</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:20px;background:#0f1117;color:#f1f2f6}
  h1{color:#818cf8}h2{color:#6366f1;font-size:14px;margin-top:24px}
  button{background:#6366f1;color:#fff;border:none;padding:9px 18px;border-radius:8px;cursor:pointer;font-size:13px;margin:4px}
  button:hover{background:#818cf8}
  textarea,input{width:100%;padding:9px;background:#161820;color:#f1f2f6;border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:13px;box-sizing:border-box;margin-top:6px}
  pre{background:#161820;padding:12px;border-radius:8px;font-size:12px;overflow-x:auto;white-space:pre-wrap;color:#a5b4fc;border:1px solid rgba(99,102,241,0.2)}
  .ok{color:#10b981}.err{color:#f43f5e}.row{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap}
  label{font-size:12px;color:#8b91a8}
</style></head>
<body>
<h1>🔊 Vox Backend — Test Page</h1>
<p style="color:#8b91a8;font-size:13px">Use this page to verify each endpoint works before opening React.</p>

<h2>1. Health Check</h2>
<button onclick="check()">Check /  (GET)</button>
<pre id="r0">—</pre>

<h2>2. Chat (Text)</h2>
<label>Message</label>
<textarea id="chatMsg" rows="2">Hello! Tell me one interesting fact about Telugu language.</textarea>
<div class="row"><button onclick="chatTest()">Send to /chat</button></div>
<pre id="r1">—</pre>

<h2>3. File Upload + Chat</h2>
<label>Choose a PDF, Word, image, or text file</label>
<input type="file" id="fileInput" accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.gif,.webp">
<label style="margin-top:8px;display:block">Question about the file (optional)</label>
<textarea id="fileMsg" rows="2">Please summarise this document.</textarea>
<div class="row"><button onclick="fileTest()">Send to /upload_chat</button></div>
<pre id="r2">—</pre>

<h2>4. TTS (Text-to-Speech)</h2>
<label>Text</label>
<input type="text" id="ttsText" value="Namaste! This is Vox speaking.">
<div class="row"><button onclick="ttsTest()">Send to /tts</button><audio id="audioOut" controls style="margin-top:6px"></audio></div>
<pre id="r3">—</pre>

<script>
const show=(id,data,ok=true)=>{ document.getElementById(id).textContent=typeof data==='object'?JSON.stringify(data,null,2):data; document.getElementById(id).className=ok?'ok':'err'; }

async function check(){
  try{ const r=await fetch('/'); show('r0',await r.json()); }catch(e){ show('r0','ERROR: '+e,false); }
}

async function chatTest(){
  const msg=document.getElementById('chatMsg').value.trim();
  show('r1','Sending…');
  try{
    const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});
    const d=await r.json();
    show('r1', d.response || d.error, !!d.response);
  }catch(e){ show('r1','ERROR: '+e,false); }
}

async function fileTest(){
  const file=document.getElementById('fileInput').files[0];
  if(!file){ show('r2','Please choose a file first',false); return; }
  const msg=document.getElementById('fileMsg').value.trim();
  show('r2','Reading file…');
  const reader=new FileReader();
  reader.onload=async(ev)=>{
    const dataUrl=ev.target.result;
    const base64=dataUrl.split(',')[1];
    show('r2','Sending to backend…');
    try{
      const r=await fetch('/upload_chat',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:msg,filename:file.name,filetype:file.type,filedata:base64})
      });
      const d=await r.json();
      show('r2', d.response || d.error, !!d.response);
    }catch(e){ show('r2','ERROR: '+e,false); }
  };
  reader.readAsDataURL(file);
}

async function ttsTest(){
  const text=document.getElementById('ttsText').value;
  show('r3','Generating audio…');
  try{
    const r=await fetch('/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
    if(!r.ok){ const e=await r.json(); show('r3','ERROR: '+e.error,false); return; }
    const blob=await r.blob();
    const url=URL.createObjectURL(blob);
    document.getElementById('audioOut').src=url;
    document.getElementById('audioOut').play();
    show('r3','Audio ready ✓');
  }catch(e){ show('r3','ERROR: '+e,false); }
}

// Auto-check on load
check();
</script>
</body></html>"""
    return html, 200, {"Content-Type": "text/html"}


@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json(force=True, silent=True) or {}
        user_message = (data.get("message") or "").strip()
        if not user_message:
            return jsonify({"error": "empty message"}), 400
        reply = ask_llm(user_message)
        return jsonify({"response": reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/upload_chat", methods=["POST"])
def upload_chat():
    """
    JSON body:
      { message: str, filename: str, filetype: str, filedata: str (base64) }
    """
    try:
        data = request.get_json(force=True, silent=True) or {}
        user_message = (data.get("message") or "").strip()
        filename     = data.get("filename", "file")
        filetype     = (data.get("filetype") or "").strip()
        filedata_b64 = (data.get("filedata") or "").strip()

        if not filedata_b64:
            return jsonify({"error": "no file data received"}), 400

        # Strip data-URL prefix if present
        if "," in filedata_b64:
            filedata_b64 = filedata_b64.split(",", 1)[1]

        raw_bytes = base64.b64decode(filedata_b64)

        # ── Image ──────────────────────────────────────────────────────
        if filetype.startswith("image/"):
            reply = analyse_image(raw_bytes, user_message)
            return jsonify({"response": reply})

        # ── Document ───────────────────────────────────────────────────
        extracted = extract_text_from_file(raw_bytes, filetype, filename)
        extracted  = extracted[:6000]   # keep within context window

        system = (
            "You are Vox, a helpful multilingual AI assistant. "
            "The user has shared a document. Answer their question based on its contents. "
            "Be concise and use markdown formatting."
        )
        prompt = (
            f'File: "{filename}"\n\n'
            f"=== DOCUMENT CONTENTS ===\n{extracted}\n=== END ===\n\n"
            f"User: {user_message or 'Please summarise and analyse this document.'}"
        )
        reply = ask_llm(prompt, system=system, use_history=False)
        return jsonify({"response": reply})

    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


@app.route("/tts", methods=["POST"])
def tts():
    if gtts_mod is None:
        return jsonify({"error": f"gTTS not installed: {err_gtts}"}), 500
    try:
        data = request.get_json(force=True, silent=True) or {}
        text = (data.get("text") or "").strip()[:600]
        if not text:
            return jsonify({"error": "empty text"}), 400
        tts_obj = gtts_mod.gTTS(text=text, lang="en")
        buf = io.BytesIO()
        tts_obj.write_to_fp(buf)
        buf.seek(0)
        return send_file(buf, mimetype="audio/mpeg")
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/stt", methods=["POST"])
def stt():
    try:
        import whisper, sounddevice as sd, numpy as np
        import scipy.io.wavfile as wav_io

        sample_rate = 16000
        duration    = 5
        audio_data  = sd.rec(int(duration * sample_rate),
                             samplerate=sample_rate, channels=1, dtype="float32")
        sd.wait()

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            wav_io.write(f.name, sample_rate, (audio_data * 32767).astype("int16"))
            model  = whisper.load_model("base")
            result = model.transcribe(f.name)
            os.unlink(f.name)

        return jsonify({"text": result.get("text", "")})
    except Exception as e:
        return jsonify({"error": str(e), "text": ""}), 500


@app.route("/clear", methods=["POST"])
def clear_history():
    _history.clear()
    return jsonify({"ok": True, "message": "History cleared"})


# ════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("\n" + "═"*55)
    print("  🔊  VOX BACKEND")
    print("═"*55)
    print(f"  Python  : {sys.version.split()[0]}")
    print(f"  Model   : {OLLAMA_MODEL}")
    print(f"  flask   : ✓")
    print(f"  ollama  : {'✓' if ollama_mod else '✗  pip install ollama'}")
    print(f"  gtts    : {'✓' if gtts_mod else '✗  pip install gtts'}")
    print(f"  pdfplumber: {'✓' if pdfplumber_mod else '✗  pip install pdfplumber'}")
    print(f"  python-docx: {'✓' if docx_mod else '✗  pip install python-docx'}")
    print("═"*55)
    print("  Test page → http://localhost:5000/test")
    print("  React app → http://localhost:3000")
    print("═"*55 + "\n")

    # Make sure Ollama is reachable before starting
    if ollama_mod:
        try:
            ollama_mod.list()
            print("  ✓ Ollama server is running\n")
        except Exception:
            print("  ⚠  Ollama server NOT running.")
            print("     Open another terminal and run:  ollama serve\n")

    app.run(host="0.0.0.0", port=5000, debug=True)