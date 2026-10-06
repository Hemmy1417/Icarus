"""What counts as an image file.

The contract cannot look at a picture. It can read a file the way a decoder
does up to the point where pixels begin, and refuse one a decoder would stop
on, so that what is filed is something a node can open. A PNG is checked
whole. A JPEG is checked through its tables, its frame and its scans; the
compressed picture inside the scans is the one part left unread."""
import json
import zlib

import pytest

from conftest import (  # noqa: F401
    INSTALLER, OWNER, active_milestone, as_, chunk, err, ihdr, jfif, jpeg, milestone, png,
    png_file, seg,
)

GREY = b"\x08\x00\x08\x00\x08\x01\x01\x11\x00"                    # one 8 by 8 grey component
COLOUR = b"\x08\x00\x10\x00\x10\x03\x01\x22\x00\x02\x11\x00\x03\x11\x00"
ONE_CODE = b"\x01" + b"\x00" * 15
NO_ZEROS = zlib.compress(bytes((i + 3) % 251 + 1 for i in range(300)), 9)
assert 0 not in NO_ZEROS[:79]
GOOD_COLOUR = b"\x08\x00\x10\x00\x10\x03\x01\x22\x00\x02\x11\x00\x03\x11\x00"   # 4:2:0


def filed(module, c, data, who=INSTALLER):
    _, mid = active_milestone(module, c)
    as_(module, who)
    return json.loads(c.submit_image(mid, "{}", data))["item_id"]


def refused(module, c, data, why):
    _, mid = active_milestone(module, c)
    as_(module, OWNER)
    with pytest.raises(err(module), match=why):
        c.submit_image(mid, "{}", data)
    assert milestone(c, mid)["evidence"]["1"] == []


def rows(*lines) -> bytes:
    return chunk(b"IDAT", zlib.compress(b"".join(lines)))


class TestAJpegADecoderOpens:
    @pytest.mark.parametrize("data", [
        jpeg(),
        jfif(b"a note", size=4000),
        jpeg(sof=seg(0xc1, GREY)),
        # every table in one segment, as most encoders write them
        jpeg(dc=seg(0xc4, b"\x00" + ONE_CODE + b"\x0b" + b"\x10" + ONE_CODE + b"\xfa"), ac=b""),
        # colour, with a second quantisation table in the same segment
        jpeg(dqt=seg(0xdb, b"\x00" + b"\x01" * 64 + b"\x01" + b"\x02" * 64),
             sof=seg(0xc0, COLOUR.replace(b"\x02\x11\x00", b"\x02\x11\x01")),
             sos=seg(0xda, b"\x03\x01\x00\x02\x00\x03\x00\x00\x3f\x00")),
        # a sixteen-bit quantisation table
        jpeg(dqt=seg(0xdb, b"\x10" + b"\x00\x01" * 64)),
        # restart markers and stuffed bytes inside the scan, and a restart interval
        jpeg(note=seg(0xdd, b"\x00\x04"), scan=b"\x12\xff\x00\x34\xff\xd0\x56\xff\xd7\x78"),
        # application data and comments anywhere before the scan
        jpeg(note=seg(0xe1, b"Exif\x00\x00" + b"\xff\xd9" * 4) + seg(0xfe, b"\xff\xc3 text")
             + seg(0xef, b"")),
        # an empty table segment, which some encoders leave behind
        jpeg(note=seg(0xc4) + seg(0xdb)),
        # a fill byte before the closing marker
        jpeg(scan=b"\x12\x34\xff"),
        # fill bytes before a segment
        jpeg(note=b"\xff\xff" + seg(0xfe, b"after fill")),
        # as tall and as wide as a round reads
        jpeg(sof=seg(0xc0, b"\x08\x20\x00\x20\x00\x01\x01\x11\x00")),
        # three components read together, ten blocks to the unit
        jpeg(dqt=seg(0xdb, b"\x00" + b"\x01" * 64),
             sof=seg(0xc0, b"\x08\x00\x10\x00\x10\x03\x01\x42\x00\x02\x11\x00\x03\x11\x00"),
             sos=seg(0xda, b"\x03\x01\x00\x02\x00\x03\x00\x00\x3f\x00")),
        # the same eighteen blocks, read one component to a scan
        jpeg(sof=seg(0xc0, b"\x08\x00\x10\x00\x10\x03\x01\x44\x00\x02\x11\x00\x03\x11\x00")),
        # a colour picture read one component, then the other two together
        jpeg(sof=seg(0xc0, GOOD_COLOUR))[:-2]
        + seg(0xda, b"\x02\x02\x00\x03\x00\x00\x3f\x00") + b"\x00" * 4 + b"\xff\xd9",
        # application data a decoder parses, at the least it needs
        jpeg(note=seg(0xe2, b"ICC_PROFILE\x00\x01\x01") + seg(0xee, b"Adobe\x00\x64\x00\x00\x00\x00\x00\x00")
             + seg(0xe0, b"JFXX\x00\x10") + seg(0xe2, b"MPF\x00")),
        # the most a Huffman table holds: 256 codes
        jpeg(dc=seg(0xc4, b"\x00" + b"\x00" * 8 + b"\xff\x01" + b"\x00" * 6 + b"\x00" * 256)),
    ])
    def test_it_is_taken(self, module, c, data):
        assert filed(module, c, data)

    def test_a_progressive_file_is_taken_scan_by_scan(self, module, c):
        """The first pass of the lowest term, the rest of the spectrum, then
        a pass that refines both, each with only the tables it needs."""
        data = jpeg(sof=seg(0xc2, GREY), ac=b"",
                    sos=seg(0xda, b"\x01\x01\x00\x00\x00\x01"), scan=b"\x11" * 4) \
            [:-2] + seg(0xc4, b"\x10" + ONE_CODE + b"\xe0") \
            + seg(0xda, b"\x01\x01\x00\x01\x3f\x01") + b"\x22" * 4 \
            + seg(0xda, b"\x01\x01\x00\x00\x00\x10") + b"\x33" * 4 + b"\xff\xd9"
        assert filed(module, c, data)

    @pytest.mark.parametrize("data,why", [
        (jpeg(end=b""), "does not end at its closing marker"),
        (jpeg() + b"\x00", "does not end at its closing marker"),
        (jpeg(scan=b"\x00\x00\xff\xd9\x00\x00"), "carries data after its closing marker"),
        (jpeg(sos=b"", scan=b""), "closes before it holds a scan"),
        (jpeg(sof=b""), "a scan comes before its frame"),
        (jpeg(sof=seg(0xc0, GREY) * 2), "declares its frame twice or not at all"),
        (jpeg(sof=seg(0xc0, b"\x08\x00\x08")), "declares its frame twice or not at all"),
        (jpeg(sof=seg(0xc0, b"\x0c" + GREY[1:])), "frame describes no image a decoder knows"),
        (jpeg(sof=seg(0xc0, b"\x08\x00\x00" + GREY[3:])), "frame describes no image"),
        (jpeg(sof=seg(0xc0, b"\x08\x00\x08\x00\x00" + GREY[5:])), "frame describes no image"),
        (jpeg(sof=seg(0xc0, GREY[:5] + b"\x02" + GREY[6:] + b"\x02\x11\x00")),
         "frame describes no image"),
        (jpeg(sof=seg(0xc0, GREY + b"\x00")), "frame describes no image"),
        (jpeg(sof=seg(0xc0, GREY[:7] + b"\x51" + GREY[8:])), "frame describes no image"),
        (jpeg(sof=seg(0xc0, GREY[:7] + b"\x10" + GREY[8:])), "frame describes no image"),
        (jpeg(sof=seg(0xc0, GREY[:8] + b"\x04")), "frame describes no image"),
        (jpeg(sof=seg(0xc0, GREY[:7] + b"\x01" + GREY[8:])), "frame describes no image"),
        (jpeg(sof=seg(0xc0, GREY[:7] + b"\x15" + GREY[8:])), "frame describes no image"),
        (jpeg(sof=seg(0xc0, COLOUR.replace(b"\x02\x11", b"\x01\x11"))), "frame describes no image"),
        (jpeg(sof=seg(0xc3, GREY)), "a kind of JPEG a decoder may not read"),
        (jpeg(sof=seg(0xc9, GREY)), "a kind of JPEG a decoder may not read"),
        (jpeg(note=b"\xff\xd0\x00\x02"), "a kind of JPEG a decoder may not read"),
        (jpeg(note=b"\xff\xfe\x00\x01"), "a segment runs past the end of the file"),
        (jpeg(note=b"\xff\xfe\xff\xff"), "a segment runs past the end of the file"),
        (jpeg(note=b"\x00\x00\x00\x00"), "a segment is missing where one must begin"),
        (jpeg(dqt=b""), "uses a table the file never defines"),
        (jpeg(dc=b""), "uses a table the file never defines"),
        (jpeg(ac=b""), "uses a table the file never defines"),
        (jpeg(sos=seg(0xda, b"\x01\x01\x10\x00\x3f\x00")), "uses a table the file never defines"),
        (jpeg(sos=seg(0xda, b"\x01\x01\x01\x00\x3f\x00")), "uses a table the file never defines"),
        (jpeg(sos=seg(0xda, b"\x01\x02\x00\x00\x3f\x00")), "uses a table the file never defines"),
        (jpeg(sof=seg(0xc0, GREY[:8] + b"\x01")), "uses a table the file never defines"),
        (jpeg(dqt=seg(0xdb, b"\x00" + b"\x01" * 63)), "a quantisation table is malformed"),
        (jpeg(dqt=seg(0xdb, b"\x04" + b"\x01" * 64)), "a quantisation table is malformed"),
        (jpeg(dqt=seg(0xdb, b"\x20" + b"\x01" * 192)), "a quantisation table is malformed"),
        (jpeg(dc=seg(0xc4, b"\x00\x03" + b"\x00" * 15 + b"\x00\x01\x02")),
         "a Huffman table is malformed"),
        (jpeg(dc=seg(0xc4, b"\x00\x02" + b"\x00" * 15 + b"\x00\x01")),
         "a Huffman table is malformed"),
        (jpeg(dc=seg(0xc4, b"\x00" + ONE_CODE + b"\x0c")), "a Huffman table is malformed"),
        (jpeg(ac=seg(0xc4, b"\x10" + ONE_CODE + b"\x0b")), "a Huffman table is malformed"),
        (jpeg(dc=seg(0xc4, b"\x00\x00\x05" + b"\x00" * 14 + b"\x00")),
         "a Huffman table is malformed"),
        (jpeg(dc=seg(0xc4, b"\x00" + b"\x00" * 8 + b"\xff\x02" + b"\x00" * 6 + b"\x00" * 257)),
         "a Huffman table is malformed"),
        (jpeg(dc=seg(0xc4, b"\x00" + ONE_CODE + b"\x1b")), "a Huffman table is malformed"),
        (jpeg(dc=seg(0xc4, b"\x20" + ONE_CODE + b"\x00")), "a Huffman table is malformed"),
        (jpeg(dc=seg(0xc4, b"\x04" + ONE_CODE + b"\x00")), "a Huffman table is malformed"),
        (jpeg(dc=seg(0xc4, b"\x00" + ONE_CODE + b"\x00" + b"\x00" * 5)),
         "a Huffman table is malformed"),
        (jpeg(note=seg(0xdd, b"\x00\x04\x00")), "its restart interval is malformed"),
        (jpeg(sos=seg(0xda, b"")), "a scan comes before its frame"),
        (jpeg(sos=seg(0xda, b"\x02\x01\x00\x02\x00\x00\x3f\x00")), "a scan is malformed"),
        (jpeg(sos=seg(0xda, b"\x00\x00\x3f\x00")), "a scan is malformed"),
        (jpeg(sos=seg(0xda, b"\x01\x01\x00\x00\x3f\x00\x00")), "a scan is malformed"),
        (jpeg(sos=seg(0xda, b"\x01\x01\x00\x00\x00\x00")), "a scan is malformed"),
        # sampling that does not divide the largest: three across beside two
        (jpeg(sof=seg(0xc0, b"\x08\x00\x10\x00\x10\x03\x01\x31\x00\x02\x21\x00\x03\x11\x00")),
         "frame describes no image"),
        (jpeg(sof=seg(0xc0, b"\x08\x00\x10\x00\x10\x03\x01\x13\x00\x02\x12\x00\x03\x11\x00")),
         "frame describes no image"),
        # components named out of the order the frame gave them
        (jpeg(sof=seg(0xc0, GOOD_COLOUR), sos=seg(0xda, b"\x03\x03\x00\x02\x00\x01\x00\x00\x3f\x00")),
         "a scan is malformed"),
        (jpeg(sof=seg(0xc0, GOOD_COLOUR), sos=seg(0xda, b"\x02\x02\x00\x01\x00\x00\x3f\x00")),
         "a scan is malformed"),
        # a second scan after one that read the whole picture
        (jpeg()[:-2] + seg(0xda, b"\x01\x01\x00\x00\x3f\x00") + b"\x00" * 4 + b"\xff\xd9",
         "a scan after its picture is complete"),
        (jpeg(note=seg(0xe0, b"JFIF\x00\x01")), "application data a decoder reads is cut short"),
        (jpeg(app0=seg(0xe0, b"JFIF\x00" + b"\x00" * 8)), "application data a decoder reads is cut short"),
        (jpeg(note=seg(0xe2, b"ICC_PROFILE\x00\x01")), "application data a decoder reads is cut short"),
        (jpeg(note=seg(0xee, b"Adobe\x00")), "application data a decoder reads is cut short"),
        # one component named twice in a scan
        (jpeg(sof=seg(0xc0, COLOUR), sos=seg(0xda, b"\x03\x01\x00\x01\x00\x03\x00\x00\x3f\x00")),
         "a scan is malformed"),
        # more blocks to the unit than a decoder holds
        (jpeg(sof=seg(0xc0, b"\x08\x00\x10\x00\x10\x03\x01\x33\x00\x02\x11\x00\x03\x11\x00"),
              sos=seg(0xda, b"\x03\x01\x00\x02\x00\x03\x00\x00\x3f\x00")),
         "a scan is malformed"),
        # a progressive pass that takes the whole spectrum at once
        (jpeg(sof=seg(0xc2, GREY), sos=seg(0xda, b"\x01\x01\x00\x00\x3f\x00")),
         "a scan is malformed"),
        # a progressive pass of the later terms for two components together
        (jpeg(sof=seg(0xc2, COLOUR), sos=seg(0xda, b"\x02\x01\x00\x02\x00\x01\x3f\x00")),
         "a scan is malformed"),
        (jpeg(sof=seg(0xc0, b"\x08\x20\x01\x00\x08\x01\x01\x11\x00")),
         "more pixels than a round reads"),
        (jpeg(sof=seg(0xc0, b"\x08\x00\x08\x20\x01\x01\x01\x11\x00")),
         "more pixels than a round reads"),
        (jpeg(sof=seg(0xc0, b"\x08\xff\xff\xff\xff\x01\x01\x11\x00")),
         "more pixels than a round reads"),
        (jpeg(sos=seg(0xda, b"\x01\x01\x00\x00\x3f\x01")), "a scan is malformed"),
        (jpeg(sof=seg(0xc2, GREY), sos=seg(0xda, b"\x01\x01\x00\x05\x02\x00")),
         "a scan is malformed"),
        (jpeg(sof=seg(0xc2, GREY), sos=seg(0xda, b"\x01\x01\x00\x01\x40\x00")),
         "a scan is malformed"),
        (jpeg(sof=seg(0xc2, GREY), sos=seg(0xda, b"\x01\x01\x00\x00\x00\x0e")),
         "a scan is malformed"),
        (jpeg(sof=seg(0xc2, GREY), sos=seg(0xda, b"\x01\x01\x00\x00\x00\x31")),
         "a scan is malformed"),
        (jpeg(sof=seg(0xc2, GREY), dc=b"", sos=seg(0xda, b"\x01\x01\x00\x00\x00\x00")),
         "uses a table the file never defines"),
        (jpeg(sof=seg(0xc2, GREY), ac=b"", sos=seg(0xda, b"\x01\x01\x00\x01\x3f\x00")),
         "uses a table the file never defines"),
        # a pass that refines the rest of the spectrum still reads its table
        (jpeg(sof=seg(0xc2, GREY), ac=b"", sos=seg(0xda, b"\x01\x01\x00\x01\x3f\x10")),
         "uses a table the file never defines"),
    ])
    def test_one_a_decoder_would_stop_on_is_refused(self, module, c, data, why):
        refused(module, c, data, "that JPEG is not one a decoder opens: .*" + why)

    def test_a_file_cut_into_more_segments_than_a_photograph_has_is_refused(self, module, c):
        """A small file can be thousands of empty segments, and every node
        would walk each one. The six a picture needs and 2,042 comments
        are taken; one comment more is not."""
        assert filed(module, c, jpeg(note=seg(0xfe) * 2042))
        refused(module, c, jpeg(note=seg(0xfe) * 2043),
                "that JPEG is not one a decoder opens: it is cut into more segments than a round reads")

    def test_a_refining_pass_of_the_lowest_term_needs_no_table(self, module, c):
        data = jpeg(sof=seg(0xc2, GREY), ac=b"", sos=seg(0xda, b"\x01\x01\x00\x00\x00\x01"))[:-2] \
            + seg(0xda, b"\x01\x01\x30\x00\x00\x10") + b"\x00" * 4 + b"\xff\xd9"
        assert filed(module, c, data)

    @pytest.mark.parametrize("data", [
        b"\xff\xd8\xff\xe1\x00\x10Exif\x00" + jpeg()[20:],
        b"\xff\xd8\xff\xe0\x00\x10JFXX\x00" + jpeg()[11:],
        b"\xff\xd8", b"GIF89a" + b"\x00" * 60, b"\x89PNG" + b"\x00" * 60,
    ])
    def test_a_file_that_is_neither_kind_is_refused(self, module, c, data):
        refused(module, c, data, "the runtime reads PNG and JFIF JPEG only")


class TestAPngADecoderOpens:
    @pytest.mark.parametrize("data", [
        png_file(),
        png(b"a note", size=2000),
        png_file(ihdr=ihdr(2, 2, 8, 2), idat=rows(b"\x00" + b"\x01" * 6, b"\x04" + b"\x02" * 6)),
        png_file(ihdr=ihdr(2, 2, 8, 6), idat=rows(b"\x01" + b"\x01" * 8, b"\x02" + b"\x02" * 8)),
        png_file(ihdr=ihdr(2, 2, 16, 4), idat=rows(b"\x03" + b"\x01" * 8, b"\x00" + b"\x02" * 8)),
        png_file(ihdr=ihdr(3, 2, 1, 0), idat=rows(b"\x00\xa0", b"\x00\x40")),
        png_file(ihdr=ihdr(2, 2, 8, 3), plte=chunk(b"PLTE", b"\x00" * 6),
                 idat=rows(b"\x00\x00\x01", b"\x00\x01\x00")),
        # the chunks a decoder reads before pixels, each at its own size
        png_file(note=chunk(b"tRNS", b"\x00\x01") + chunk(b"pHYs", b"\x00" * 9)
                 + chunk(b"sRGB", b"\x00") + chunk(b"cHRM", b"\x00" * 32)
                 + chunk(b"iCCP", b"name\x00\x00" + zlib.compress(b"profile"))
                 + chunk(b"tIME", b"\x00" * 7) + chunk(b"zzZz", b"anything a decoder skips")
                 + chunk(b"zTXt", b"k\x00\x00" + zlib.compress(b"\x00" * (1024 * 1024 - 18)))
                 + chunk(b"iTXt", b"k\x00\x00\x00en\x00t\x00plain text")
                 + chunk(b"iTXt", b"k\x00\x01\x00\x00\x00" + zlib.compress(b"packed text"))
                 + chunk(b"tEXt", b"k\x00v")),
        png_file(ihdr=ihdr(2, 2, 8, 2), note=chunk(b"tRNS", b"\x00" * 6),
                 idat=rows(b"\x00" + b"\x01" * 6, b"\x00" + b"\x02" * 6)),
        png_file(ihdr=ihdr(2, 2, 8, 3), plte=chunk(b"PLTE", b"\x00" * 6),
                 note=chunk(b"tRNS", b"\x00" * 2), idat=rows(b"\x00\x00\x01", b"\x00\x01\x00")),
        # as tall and as wide as a round reads
        png_file(ihdr=ihdr(1, 8192, 1, 0), idat=rows(b"\x00\x00" * 8192)),
        png_file(ihdr=ihdr(8192, 1, 1, 0), idat=rows(b"\x00" + b"\x00" * 1024)),
        # a profile that takes the whole allowance, and plain text beside it
        png_file(note=chunk(b"iCCP", b"a\x00\x00" + zlib.compress(b"\x00" * (1024 * 1024)))
                 + chunk(b"iTXt", b"k\x00\x00\x00\x00\x00plain") + chunk(b"tEXt", b"k\x00v")),
        # the image data in two chunks, with a chunk a decoder may skip before it
        png_file(note=chunk(b"gAMA", b"\x00\x00\xb1\x8f"),
                 idat=chunk(b"IDAT", zlib.compress(b"\x00\x00\x00" * 2)[:5])
                 + chunk(b"IDAT", zlib.compress(b"\x00\x00\x00" * 2)[5:])),
        # interlaced: a 3 by 3 image is five passes, of 1, 1, 1, 2 and 1 rows
        png_file(ihdr=ihdr(3, 3, 8, 0, interlace=1),
                 idat=rows(b"\x00\x01", b"\x00\x01", b"\x00\x01\x01", b"\x00\x01", b"\x00\x01",
                           b"\x00\x01\x01\x01")),
    ])
    def test_it_is_taken(self, module, c, data):
        assert filed(module, c, data)

    @pytest.mark.parametrize("data,why", [
        (png_file()[:-1], "ends before its closing chunk"),
        (png_file(iend=b""), "ends before its closing chunk"),
        (png_file(idat=b"\x00\x00\xff\xffIDAT" + b"\x00" * 8), "a chunk runs past the end"),
        (png_file(idat=chunk(b"IDAT", zlib.compress(b"\x00\x00\x00" * 2))[:-1] + b"\x00"),
         "a chunk fails its checksum"),
        (png_file(ihdr=b""), "header chunk is missing or out of place"),
        (png_file(note=ihdr()), "header chunk is missing or out of place"),
        (png_file(ihdr=chunk(b"gAMA", b"\x00\x00\xb1\x8f") + ihdr()), "header chunk is missing"),
        (png_file(ihdr=chunk(b"IHDR", b"\x00" * 12)), "its header is the wrong size"),
        (png_file(ihdr=ihdr(0, 2)), "header describes no image a decoder knows"),
        (png_file(ihdr=ihdr(2, 0)), "header describes no image"),
        (png_file(ihdr=ihdr(2, 2, 8, 5)), "header describes no image"),
        (png_file(ihdr=ihdr(2, 2, 4, 2)), "header describes no image"),
        (png_file(ihdr=ihdr(2, 2, 16, 3)), "header describes no image"),
        (png_file(ihdr=ihdr(2, 2, 3, 0)), "header describes no image"),
        (png_file(ihdr=ihdr(compression=1)), "header describes no image"),
        (png_file(ihdr=ihdr(filtering=1)), "header describes no image"),
        (png_file(ihdr=ihdr(interlace=2)), "header describes no image"),
        (png_file(ihdr=ihdr(2, 2, 8, 3), idat=rows(b"\x00\x00\x01", b"\x00\x01\x00")),
         "it has no palette"),
        (png_file(plte=chunk(b"PLTE", b"\x00" * 4)), "palette is malformed or out of place"),
        (png_file(plte=chunk(b"PLTE")), "palette is malformed or out of place"),
        (png_file(plte=chunk(b"PLTE", b"\x00" * 771)), "palette is malformed or out of place"),
        (png_file(plte=chunk(b"PLTE", b"\x00" * 3) * 2), "palette is malformed or out of place"),
        (png_file(pad=chunk(b"PLTE", b"\x00" * 3)), "palette is malformed or out of place"),
        (png_file(idat=b""), "it holds no image data"),
        (png_file(idat=chunk(b"IDAT", zlib.compress(b"\x00\x00\x00" * 2)[:5])
                  + chunk(b"tEXt", b"k\x00v")
                  + chunk(b"IDAT", zlib.compress(b"\x00\x00\x00" * 2)[5:])),
         "image data is split by another chunk"),
        (png_file(iend=chunk(b"IEND", b"\x00")), "does not end at its closing chunk"),
        (png_file() + chunk(b"tEXt", b"k\x00v"), "does not end at its closing chunk"),
        (png_file(note=chunk(b"ABCD", b"x")), "a chunk a decoder must understand"),
        (png_file(note=chunk(b"te1t", b"x")), "a chunk a decoder must understand"),
        (png_file(idat=chunk(b"IDAT", b"not a zlib stream at all")), "does not inflate"),
        (png_file(idat=chunk(b"IDAT", zlib.compress(b"\x00\x00\x00" * 2)[:-6])),
         "not the size its header says"),
        (png_file(idat=rows(b"\x00\x00\x00")), "not the size its header says"),
        # every row is there and the stream never says it has ended
        (png_file(idat=chunk(b"IDAT", zlib.compress(b"\x00\x00\x00" * 2)[:-1])),
         "not the size its header says"),
        # the first pass of an interlaced image, whole, and none of the others
        (png_file(ihdr=ihdr(3, 3, 8, 0, interlace=1), idat=rows(b"\x00\x01")),
         "not the size its header says"),
        (png_file(idat=rows(b"\x00\x00\x00", b"\x00\x00")), "not the size its header says"),
        (png_file(idat=rows(b"\x00\x00\x00", b"\x00\x00\x00", b"\x00")),
         "longer than its header says"),
        (png_file(idat=chunk(b"IDAT", zlib.compress(b"\x00\x00\x00" * 2) + b"more")),
         "not the size its header says"),
        (png_file(idat=rows(b"\x00\x00\x00", b"\x05\x00\x00")), "names no filter"),
        (png_file(ihdr=ihdr(3, 3, 8, 0, interlace=1), idat=rows(b"\x00\x00\x00\x00" * 3)),
         "its header says"),
        (png_file(ihdr=ihdr(60_000, 60_000, 8, 6)), "more pixels than a round reads"),
        # within the longest side, and four times the pixel data a round reads
        (png_file(ihdr=ihdr(8192, 8192, 8, 6)), "more pixels than a round reads"),
        # a few thousand bytes that would cost every node a loop of millions of rows
        (png_file(ihdr=ihdr(1, 8193, 1, 0)), "more pixels than a round reads"),
        (png_file(ihdr=ihdr(8193, 1, 1, 0)), "more pixels than a round reads"),
        (png_file(note=chunk(b"tRNS", b"\x00")), "a chunk a decoder reads is the wrong size"),
        (png_file(note=chunk(b"tRNS")), "a chunk a decoder reads is the wrong size"),
        (png_file(ihdr=ihdr(2, 2, 8, 2), note=chunk(b"tRNS", b"\x00" * 3),
                  idat=rows(b"\x00" + b"\x01" * 6, b"\x00" + b"\x02" * 6)),
         "a chunk a decoder reads is the wrong size"),
        (png_file(ihdr=ihdr(2, 2, 8, 6), note=chunk(b"tRNS", b"\x00" * 2),
                  idat=rows(b"\x00" + b"\x01" * 8, b"\x00" + b"\x02" * 8)),
         "a chunk a decoder reads is the wrong size"),
        (png_file(ihdr=ihdr(2, 2, 8, 3), plte=chunk(b"PLTE", b"\x00" * 6),
                  note=chunk(b"tRNS", b"\x00" * 3), idat=rows(b"\x00\x00\x01", b"\x00\x01\x00")),
         "a chunk a decoder reads is the wrong size"),
        (png_file(ihdr=ihdr(2, 2, 8, 3), plte=chunk(b"tRNS", b"\x00") + chunk(b"PLTE", b"\x00" * 6),
                  idat=rows(b"\x00\x00\x01", b"\x00\x01\x00")),
         "a chunk a decoder reads is the wrong size"),
        (png_file(note=chunk(b"gAMA", b"\x00")), "a chunk a decoder reads is the wrong size"),
        (png_file(note=chunk(b"pHYs", b"\x00")), "a chunk a decoder reads is the wrong size"),
        (png_file(note=chunk(b"cHRM", b"\x00")), "a chunk a decoder reads is the wrong size"),
        (png_file(note=chunk(b"sRGB")), "a chunk a decoder reads is the wrong size"),
        (png_file(note=chunk(b"tIME", b"\x00")), "a chunk a decoder reads is the wrong size"),
        (png_file(note=chunk(b"acTL", b"\x00" * 8)), "it is an animation"),
        (png_file(note=chunk(b"fcTL", b"\x00" * 26)), "it is an animation"),
        (png_file(pad=chunk(b"fdAT", b"\x00" * 8)), "it is an animation"),
        (png_file(note=chunk(b"iCCP", b"profile with no end to its name")),
         "a compressed chunk a decoder reads does not unpack"),
        (png_file(note=chunk(b"iCCP", b"a\x00")), "a compressed chunk a decoder reads does not unpack"),
        (png_file(note=chunk(b"iCCP", b"a\x00\x01" + zlib.compress(b"p"))), "does not unpack"),
        (png_file(note=chunk(b"iCCP", b"a\x00\x00not a stream")), "does not unpack"),
        (png_file(note=chunk(b"iCCP", b"a\x00\x00" + zlib.compress(b"p")[:-1])), "does not unpack"),
        (png_file(note=chunk(b"iCCP", b"\x00\x00" + zlib.compress(b"p"))), "does not unpack"),
        (png_file(note=chunk(b"iCCP", b"n" * 80 + b"\x00\x00" + zlib.compress(b"p"))),
         "does not unpack"),
        (png_file(note=chunk(b"zTXt", b"k\x00\x01" + zlib.compress(b"p"))), "does not unpack"),
        (png_file(note=chunk(b"zTXt", b"k\x00\x00" + zlib.compress(b"\x00" * (1024 * 1024 + 1)))),
         "does not unpack"),
        # each within the allowance, and together past it
        (png_file(note=chunk(b"zTXt", b"k\x00\x00" + zlib.compress(b"\x00" * 600_000)) * 2),
         "does not unpack"),
        (png_file(note=chunk(b"iCCP", b"a\x00\x00" + zlib.compress(b"\x00" * (1024 * 1024)))
                  + chunk(b"iTXt", b"k\x00\x01\x00\x00\x00" + zlib.compress(b"x"))),
         "does not unpack"),
        # a flag that is neither plain nor compressed, on text that would unpack
        (png_file(note=chunk(b"iTXt", b"k\x00\x02\x00\x00\x00" + zlib.compress(b"x"))),
         "does not unpack"),
        # a name that is empty, with a second zero further on that is not its end
        (png_file(note=chunk(b"iCCP", b"\x00\x01A\x00\x00" + zlib.compress(b"p"))), "does not unpack"),
        (png_file(note=chunk(b"zTXt", b"\x00omment\x00\x00" + zlib.compress(b"p"))), "does not unpack"),
        (png_file(note=chunk(b"iTXt", b"\x00\x01\x00\x00\x00plain")), "does not unpack"),
        # no name at all: an empty one, then a stream with no zero byte to end a name on
        (png_file(note=chunk(b"iCCP", b"\x00" + NO_ZEROS)), "does not unpack"),
        (png_file(note=chunk(b"iTXt", b"keyword with no end")), "does not unpack"),
        (png_file(note=chunk(b"iTXt", b"k\x00")), "does not unpack"),
        (png_file(note=chunk(b"iTXt", b"k\x00\x00")), "does not unpack"),
        (png_file(note=chunk(b"iTXt", b"k\x00\x02\x00en\x00t\x00text")), "does not unpack"),
        (png_file(note=chunk(b"iTXt", b"k\x00\x01\x00en\x00t\x00not a stream")), "does not unpack"),
        (png_file(note=chunk(b"iTXt", b"k\x00\x01\x01en\x00t\x00" + zlib.compress(b"p"))),
         "does not unpack"),
        (png_file(note=chunk(b"iTXt", b"k\x00\x01\x00en")), "does not unpack"),
        (png_file(note=chunk(b"iTXt", b"k\x00\x01\x00en\x00t")), "does not unpack"),
    ])
    def test_one_a_decoder_would_stop_on_is_refused(self, module, c, data, why):
        refused(module, c, data, "that PNG is not one a decoder opens: .*" + why)

    def test_the_largest_image_a_round_reads_is_taken_and_one_byte_more_is_not(self, module, c):
        """Sixty-four megabytes of pixel data, measured as it inflates and
        never held whole."""
        side, wide = 8192, 8191                             # 8192 rows of 1 + 8191 bytes
        packer = zlib.compressobj(1)
        body = b"".join(packer.compress(b"\x00" * (1 + wide)) for _ in range(side)) + packer.flush()
        assert side * (1 + wide) == 64 * 1024 * 1024
        assert filed(module, c, png_file(ihdr=ihdr(wide, side, 8, 0), idat=chunk(b"IDAT", body)))
        refused(module, c, png_file(ihdr=ihdr(wide + 1, side, 8, 0), idat=chunk(b"IDAT", body)),
                "more pixels than a round reads")
