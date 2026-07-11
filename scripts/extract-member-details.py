#!/usr/bin/env python3
import argparse
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET


NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def cell_value(cell):
    cell_type = cell.attrib.get("t", "")
    if cell_type == "inlineStr":
        inline = cell.find(f"{NS}is")
        if inline is None:
            return ""
        return "".join(node.text or "" for node in inline.iter(f"{NS}t"))
    value = cell.find(f"{NS}v")
    if value is None or value.text is None:
        return ""
    return value.text


def tidy(value):
    return re.sub(r"\s+", " ", value.strip())


def iter_rows(path):
    with zipfile.ZipFile(path) as archive:
        with archive.open("xl/worksheets/sheet1.xml") as source:
            headers = None
            row_number = 0
            for _, element in ET.iterparse(source, events=("end",)):
                if element.tag != f"{NS}row":
                    continue
                row_number += 1
                values = [tidy(cell_value(cell)) for cell in element.findall(f"{NS}c")]
                if headers is None:
                    headers = [tidy(value).lower() for value in values]
                    element.clear()
                    continue
                if len(values) < len(headers):
                    values.extend([""] * (len(headers) - len(values)))
                yield row_number, dict(zip(headers, values[:len(headers)]))
                element.clear()


def main():
    parser = argparse.ArgumentParser(description="Stream rows from Member-details.xlsx")
    parser.add_argument("file")
    parser.add_argument("--count", action="store_true")
    args = parser.parse_args()

    if args.count:
        count = sum(1 for _ in iter_rows(args.file))
        print(json.dumps({"rows": count}))
        return

    for source_row, record in iter_rows(args.file):
        record["source_row"] = source_row
        sys.stdout.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
