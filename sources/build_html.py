from pathlib import Path
root=Path(__file__).resolve().parent
html=(root/'shell.html').read_text(encoding='utf-8')
parts={ '__CSS__':(root/'style.css').read_text(encoding='utf-8'), '__CORE__':(root/'core.js').read_text(encoding='utf-8'), '__UI__':(root/'ui.js').read_text(encoding='utf-8'), '__MANIFEST__':'const MANIFEST='+(root/'manifest.json').read_text(encoding='utf-8')+';' }
for key,value in parts.items(): html=html.replace(key,value)
output=root.parent if root.name=='sources' else root
(output/'FF7_NES_EDITOR.html').write_text(html,encoding='utf-8')
print('HTML autonome reconstruit.')
