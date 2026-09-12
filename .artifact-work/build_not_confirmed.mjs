import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const numbers = `9429322092 7990525266 6376882795 9913645763 9825157936 9909802636 9081941675 9429012500 8690477966 9909397770 7572987208 9428213065 8446900221 9824297038 9574442629 9099951337 9209192877 9824146647 9427146101 9712891083 9722750790 9173871044 9726629784 9898867768 9898347778 7878121092 7433811447 9429988882 9687097455 9824179161 8866055447 7621016104 9586583899 9328226962 9106998599 7990560799 7359145000 9033095966 9825192085 7778861320 7016970177 9558551942 9879560208 7567434481 9624283021 9879083529 9328922002 9879936531 9081366531 9429089557 7226003166 9998220564 9328794110 9374214221 9586261196 9428794110 9979444666 9265706981 9687646800 9723583143 8347211197 8347038871 9712216576 9374700993 9435717461 8460099100 9712912729 9426874068 9426649098 7600023457 8000161407 9427375237 9374744908 9978807805 9879653073 9909906046 8866489209 9998073104 7990567918 7284021802 9726869013 9979940912 8460319159 9374542968 9327852521 9825338142 9998802326 9979133269 9727742223 9427925919 9328825502 9687651451`.split(/\s+/);

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Not Confirmed");
sheet.showGridLines = false;

sheet.getRange("A1:D1").merge();
sheet.getRange("A1").values = [["Not Confirmed Mobile Numbers"]];
sheet.getRange("A1:D1").format.font = { name: "Arial", size: 16, bold: true, color: "#17365D" };
sheet.getRange("A2:D2").merge();
sheet.getRange("A2").values = [["Healthy Forever 38 · Checked against 422 workshop responses · 06 Sep 2026"]];
sheet.getRange("A2:D2").format.font = { name: "Arial", size: 10, italic: true, color: "#5B6573" };
sheet.getRange("A3:D3").merge();
sheet.getRange("A3").values = [["92 of 94 unique numbers were not found in this workshop and therefore are not confirmed. Two already-confirmed numbers are excluded."]];
sheet.getRange("A3:D3").format.font = { name: "Arial", size: 10, color: "#5B6573" };

const rows = [["No.", "Mobile Number", "Status", "Source"]];
numbers.forEach((number, i) => rows.push([i + 1, `+91 ${number}`, "Not found / Not confirmed", "dashboard.coachforlife.in/workshop-master"]));
sheet.getRange(`A5:D${5 + numbers.length}`).values = rows;

const header = sheet.getRange("A5:D5");
header.format.fill = "#17365D";
header.format.font = { name: "Arial", size: 10, bold: true, color: "#FFFFFF" };
header.format.horizontalAlignment = "center";
header.format.verticalAlignment = "center";
header.format.borders = { preset: "inside", style: "thin", color: "#FFFFFF" };

const body = sheet.getRange(`A6:D${5 + numbers.length}`);
body.format.font = { name: "Arial", size: 10, color: "#1F2937" };
body.format.verticalAlignment = "center";
body.format.borders = { preset: "insideHorizontal", style: "thin", color: "#E5E7EB" };
sheet.getRange(`A6:A${5 + numbers.length}`).format.horizontalAlignment = "right";
sheet.getRange(`B6:B${5 + numbers.length}`).format.numberFormat = "@";
sheet.getRange(`C6:C${5 + numbers.length}`).format.fill = "#FFF2CC";
sheet.getRange(`C6:C${5 + numbers.length}`).format.font = { name: "Arial", size: 10, color: "#7F6000" };

sheet.getRange("A1:D3").format.rowHeight = 22;
sheet.getRange("A5:D5").format.rowHeight = 24;
body.format.rowHeight = 20;
sheet.getRange("A:A").format.columnWidth = 8;
sheet.getRange("B:B").format.columnWidth = 20;
sheet.getRange("C:C").format.columnWidth = 30;
sheet.getRange("D:D").format.columnWidth = 46;
sheet.freezePanes.freezeRows(5);

const table = sheet.tables.add(`A5:D${5 + numbers.length}`, true, "NotConfirmedNumbers");
table.style = "TableStyleMedium2";
table.showFilterButton = true;

const outputDir = "/Users/yogeshaihub/Downloads/Project/CFLdashboard-main/outputs/01a0775f-5f7c-78a1-90bb-9f71e6e22281";
await fs.mkdir(outputDir, { recursive: true });

const check = await workbook.inspect({ kind: "table", range: `Not Confirmed!A1:D${5 + numbers.length}`, include: "values,formulas", tableMaxRows: 12, tableMaxCols: 4 });
console.log(check.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 50 }, summary: "final formula error scan" });
console.log(errors.ndjson);

const preview = await workbook.render({ sheetName: "Not Confirmed", range: "A1:D20", scale: 1.5, format: "png" });
await fs.writeFile(`${outputDir}/not_confirmed_numbers_preview.png`, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/not_confirmed_numbers.xlsx`);
console.log(`Created ${numbers.length} rows`);
