import PDFDocument from "pdfkit";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface PayslipPdfInput {
  employerName: string;
  employerTaxNumber?: string | null;
  employerRegNumber?: string | null;
  employerAddress?: string | null;
  employerPhone?: string | null;
  employeeName: string;
  employeeCode: string;
  employeePosition: string;
  employeeIdNumber?: string | null;
  employeeTaxNumber?: string | null;
  employeeAddress?: string | null;
  periodYear: number;
  periodMonth: number;
  weekdayHours: number;
  weekendHours: number;
  totalHours: number;
  hourlyRateWeekday: number;
  hourlyRateWeekend: number;
  grossPay: number;
  uifDeduction: number;
  companyDeductions: { name: string; amount: number }[];
  netPay: number;
  currency?: string;
}

export function generatePayslipPdf(input: PayslipPdfInput): Promise<Buffer> {
  const currency = input.currency ?? "R";
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const money = (amount: number) => `${currency} ${amount.toFixed(2)}`;
    const pageLeft = 50;
    const pageRight = 545;
    const pageWidth = pageRight - pageLeft;
    const border = "#555555";
    const lightBorder = "#9a9a9a";
    const small = 7.5;
    const normal = 8;
    const heading = 8.5;

    function cell(text: string, x: number, y: number, width: number, height: number, options: { bold?: boolean; align?: "left" | "center" | "right" } = {}) {
      doc.font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(normal).fillColor("#111111");
      doc.text(text, x + 4, y + 3, { width: width - 8, height: height - 6, align: options.align ?? "left", ellipsis: true });
    }

    function tableRow(values: string[], widths: number[], y: number, height: number, options: { bold?: boolean; fill?: string; align?: ("left" | "center" | "right")[] } = {}) {
      let x = pageLeft;
      values.forEach((value, index) => {
        const width = widths[index];
        if (options.fill) doc.rect(x, y, width, height).fillAndStroke(options.fill, border);
        else doc.rect(x, y, width, height).stroke(border);
        cell(value, x, y, width, height, { bold: options.bold, align: options.align?.[index] });
        x += width;
      });
      return y + height;
    }

    function sectionTitle(title: string, y: number) {
      doc.rect(pageLeft, y, pageWidth, 18).fillAndStroke("#f3f4f4", border);
      cell(title, pageLeft, y, pageWidth, 18, { bold: true });
      return y + 18;
    }

    // Compact payslip header, following the supplied reference layout.
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text(`${input.employerName} - Monthly Wages`, pageLeft, 52, { width: pageWidth, align: "center" });
    doc.font("Helvetica").fontSize(8).text(`${MONTH_NAMES[input.periodMonth - 1]} ${input.periodYear}`, pageLeft, 66, { width: pageWidth, align: "right" });

    let y = 84;
    y = tableRow([input.employeeName, `Pay period: ${MONTH_NAMES[input.periodMonth - 1]} ${input.periodYear}`], [pageWidth * 0.58, pageWidth * 0.42], y, 20);
    y = tableRow([`Employee number: ${input.employeeCode}`, `Position: ${input.employeePosition}`], [pageWidth * 0.58, pageWidth * 0.42], y, 20);
    y += 18;

    y = sectionTitle("Employee details", y);
    const detailsLeft = [
      `Employee: ${input.employeeName}`,
      `Employee number: ${input.employeeCode}`,
      input.employeeIdNumber ? `ID number: ${input.employeeIdNumber}` : "ID number: Not provided",
      input.employeeTaxNumber ? `Tax number: ${input.employeeTaxNumber}` : "Tax number: Not provided",
    ];
    const detailsRight = [
      `Position: ${input.employeePosition}`,
      `Hourly rate: ${money(input.hourlyRateWeekday)}/hr`,
      input.employeeAddress ? `Address: ${input.employeeAddress}` : "Address: Not provided",
      input.employerName ? `Company: ${input.employerName}` : "",
    ];
    for (let index = 0; index < detailsLeft.length; index += 1) {
      y = tableRow([detailsLeft[index], detailsRight[index]], [pageWidth * 0.58, pageWidth * 0.42], y, 17);
    }
    y += 12;

    const earningsWidth = [pageWidth * 0.30, pageWidth * 0.16, pageWidth * 0.20, pageWidth * 0.34];
    const deductionsWidth = [pageWidth * 0.30, pageWidth * 0.16, pageWidth * 0.20, pageWidth * 0.34];
    y = sectionTitle("Income and deductions", y);
    y = tableRow(["INCOME", "HOURS", "VALUE", "DEDUCTIONS / VALUE"], earningsWidth, y, 20, { bold: true, fill: "#f8f8f8", align: ["left", "center", "right", "left"] });

    const weekdayAmount = input.weekdayHours * input.hourlyRateWeekday;
    const weekendAmount = input.weekendHours * input.hourlyRateWeekend;
    const deductionRows: Array<[string, number]> = [
      ["UIF", input.uifDeduction],
      ...input.companyDeductions.map((deduction) => [deduction.name, deduction.amount] as [string, number]),
    ];
    const incomeRows: Array<[string, number, number]> = [
      ["Weekday hours", input.weekdayHours, weekdayAmount],
      ["Weekend hours", input.weekendHours, weekendAmount],
    ];
    const rows = Math.max(incomeRows.length, deductionRows.length);
    for (let index = 0; index < rows; index += 1) {
      const income = incomeRows[index];
      const deduction = deductionRows[index];
      y = tableRow([
        income?.[0] ?? "",
        income ? income[1].toFixed(2) : "",
        income ? money(income[2]) : "",
        deduction ? `${deduction[0]}  ${money(deduction[1])}` : "",
      ], earningsWidth, y, 19, { align: ["left", "right", "right", "left"] });
    }
    y = tableRow(["Total hours", input.totalHours.toFixed(2), "Gross pay", money(input.grossPay)], earningsWidth, y, 20, { bold: true, align: ["left", "right", "left", "right"] });
    const totalDeductions = input.uifDeduction + input.companyDeductions.reduce((sum, deduction) => sum + deduction.amount, 0);
    y = tableRow(["", "", "Total deductions", money(totalDeductions)], earningsWidth, y, 20, { bold: true, align: ["left", "right", "left", "right"] });
    y += 10;

    y = tableRow(["NET PAY", "", "", money(input.netPay)], earningsWidth, y, 24, { bold: true, fill: "#f3f4f4", align: ["left", "right", "right", "right"] });
    y += 16;

    y = sectionTitle("Hours and rates", y);
    y = tableRow(["Weekday hours", input.weekdayHours.toFixed(2), "Rate", `${money(input.hourlyRateWeekday)}/hr`], earningsWidth, y, 19, { align: ["left", "right", "left", "right"] });
    y = tableRow(["Weekend hours", input.weekendHours.toFixed(2), "Rate", `${money(input.hourlyRateWeekend)}/hr`], earningsWidth, y, 19, { align: ["left", "right", "left", "right"] });

    doc.font("Helvetica").fontSize(small).fillColor("#555555");
    doc.text("This payslip contains attendance, rate, earnings, deduction, and employee information stored in FieldFace.", pageLeft, Math.min(y + 24, 760), { width: pageWidth, align: "center" });
    doc.end();
  });
}
