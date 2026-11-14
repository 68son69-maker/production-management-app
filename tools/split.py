import re, pathlib, shutil
root = pathlib.Path(__file__).resolve().parent.parent
src = root/"index.html"
shutil.copy(src, root/"index.html.bak")
html = src.read_text(encoding="utf-8")

# 1. Tach CSS
m = re.search(r"<style>(.*?)</style>", html, re.S)
(root/"css").mkdir(exist_ok=True)
(root/"css"/"style.css").write_text((m.group(1) if m else "").strip()+"\n", encoding="utf-8")
html = re.sub(r"<style>.*?</style>", '<link rel="stylesheet" href="css/style.css">', html, flags=re.S, count=1)

# 2. Tach JS
scripts = re.findall(r"<script>(.*?)</script>", html, flags=re.S)
main_js = scripts[0] if scripts else ""
patch_js = scripts[1] if len(scripts) > 1 else ""

def cut(s, a, b):
    i = s.find(a)
    j = s.find(b, i) if i>=0 else -1
    if i<0 or j<0:
        return "", s
    return s[i:j], s[:i]+s[j:]

blocks = {}
for name,a,b in [
    ("auth","/* ---------- Phan quyen","/* ---------- Ma loi"),
    ("orders","/* ---------- Don hang","/* ---------- Bo day"),
    ("harness","/* ---------- Bo day tren xe","/* ---------- Tai khoan"),
    ("accounts","/* ---------- Tai khoan Team Lead","/* ---------- Dang nhap"),
    ("login","/* ---------- Dang nhap","/* ---------- Dong bo Google Sheets"),
]:
    chunk, main_js = cut(main_js, a, b)
    blocks[name]=chunk

(root/"js").mkdir(exist_ok=True)
(root/"js"/"core.js").write_text(main_js.strip()+"\n", encoding="utf-8")
for k,v in blocks.items():
    if v.strip():
        (root/"js"/f"{k}.js").write_text(v.strip()+"\n", encoding="utf-8")
if patch_js.strip():
    (root/"js"/"auth-patch.js").write_text(patch_js.strip()+"\n", encoding="utf-8")

html = re.sub(r"(<script>.*?</script>\s*)+", "", html, flags=re.S)
tags = "\n".join([
    '<script src="js/store.js"></script>',
    '<script src="js/core.js"></script>',
    '<script src="js/auth.js"></script>',
    '<script src="js/orders.js"></script>',
    '<script src="js/harness.js"></script>',
    '<script src="js/accounts.js"></script>',
    '<script src="js/login.js"></script>',
    '<script src="js/auth-patch.js"></script>',
    '<script src="js/app.js"></script>',
])
html = html.replace("</body>", tags+"\n</body>")
src.write_text(html, encoding="utf-8")
print("Da tach xong")