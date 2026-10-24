"""HTTP production-path smoke, not a substitute for browser acceptance."""
import json
import os
import struct
import urllib.error
import urllib.request
import zlib

BASE = os.environ.get('REMEDIATION_ORIGIN', 'http://127.0.0.1:15174')


def get(path):
    with urllib.request.urlopen(BASE + path, timeout=5) as response:
        assert response.status == 200
        return response.read()


assert json.loads(get('/ha/api/health'))['db'] == 'ok'
assert len(json.loads(get('/ha/api/pages'))) == 6
for path in ['/ha/', '/ha/en/', '/ha/en/research', '/ha/projects']:
    assert b'/ha/assets/' in get(path)
for name in ['test-avatar.png', 'test-gallery.png']:
    image = get('/ha/uploads/' + name)
    assert image[:8] == b'\x89PNG\r\n\x1a\n'
    width, height = struct.unpack('!II', image[16:24])
    offset, compressed = 8, b''
    while offset < len(image):
        size = struct.unpack('!I', image[offset:offset + 4])[0]
        kind = image[offset + 4:offset + 8]
        data = image[offset + 8:offset + 8 + size]
        crc = struct.unpack('!I', image[offset + 8 + size:offset + 12 + size])[0]
        assert zlib.crc32(kind + data) == crc
        if kind == b'IDAT':
            compressed += data
        offset += size + 12
    assert len(zlib.decompress(compressed)) == height * (1 + width * 3)
assert b'Not a CV' in get('/ha/uploads/test-download.txt')
for path in ['/uploads/test-avatar.png', '/ha/assets/missing.js', '/ha/api/pages/test-hidden']:
    try:
        get(path)
    except urllib.error.HTTPError as error:
        assert error.code == 404
    else:
        raise AssertionError('Expected 404: ' + path)
print('PASS: /ha/ dist/deep links, API, six pages, PNG decode/CRC, test file, 404 boundaries')
