import codecs

# Read as latin-1 to preserve bytes, then decode utf-8
path = r'c:\Users\Test\Desktop\claude\website\dashboard.html'
with open(path, 'rb') as f:
    raw = f.read()

# The file was double-encoded: utf-8 bytes interpreted as latin-1, then saved as utf-8 again.
# Fix: decode current text as latin-1 (to get original utf-8 bytes), then decode those bytes as utf-8.
try:
    # Current text is valid utf-8 but wrong characters. If we encode as latin-1, 
    # each char maps to its code point byte. Then decode that as utf-8.
    fixed = raw.decode('utf-8').encode('latin-1').decode('utf-8')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(fixed)
    print('fixed double-encoding')
except UnicodeDecodeError as e:
    print('decode error:', e)
except Exception as e:
    print('error:', e)
