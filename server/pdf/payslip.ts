import PDFDocument from "pdfkit";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface PayslipPdfInput {
  employerName: string;
  employeeName: string;
  employeeCode: string;
  periodYear: number;
  periodMonth: number; // 1-12
  weekdayHours: number;
  weekendHours: number;
  totalHours: number;
  hourlyRateWeekday: number;
  hourlyRateWeekend: number;
  grossPay: number;
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

    const money = (n: number) => `${currency} ${n.toFixed(2)}`;

    doc.fontSize(20).text(input.employerName, { align: "left" });
    doc.moveDown(0.2);
    doc.fontSize(12).fillColor("#555").text("Payslip", { align: "left" });
    doc.fillColor("#000");
    doc.moveDown(1);

    doc.fontSize(11);
    doc.text(`Employee: ${input.employeeName}`);
    doc.text(`Employee code: ${input.employeeCode}`);
    doc.text(`Pay period: ${MONTH_NAMES[input.periodMonth - 1]} ${input.periodYear}`);
    doc.moveDown(1);

    // Table header
    const tableTop = doc.y;
    const col1 = 50, col2 = 260, col3 = 380, col4 = 490;
    doc.font("Helvetica-Bold");
    doc.text("Description", col1, tableTop);
    doc.text("Hours", col2, tableTop);
    doc.text("Rate", col3, tableTop);
    doc.text("Amount", col4, tableTop);
    doc.font("Helvetica");
    doc.moveDown(0.5);
    doc.moveTo(col1, doc.y).lineTo(545, doc.y).strokeColor("#ccc").stroke();
    doc.moveDown(0.5);

    const weekdayAmount = input.weekdayHours * input.hourlyRateWeekday;
    const weekendAmount = input.weekendHours * input.hourlyRateWeekend;

    let rowY = doc.y;
    doc.text("Weekday hours", col1, rowY);
    doc.text(input.weekdayHours.toFixed(2), col2, rowY);
    doc.text(money(input.hourlyRateWeekday) + "/hr", col3, rowY);
    doc.text(money(weekdayAmount), col4, rowY);
    doc.moveDown(0.8);

    rowY = doc.y;
    doc.text("Weekend hours", col1, rowY);
    doc.text(input.weekendHours.toFixed(2), col2, rowY);
    doc.text(money(input.hourlyRateWeekend) + "/hr", col3, rowY);
    doc.text(money(weekendAmount), col4, rowY);
    doc.moveDown(1);

    doc.moveTo(col1, doc.y).lineTo(545, doc.y).strokeColor("#ccc").stroke();
    doc.moveDown(0.5);

    doc.font("Helvetica-Bold");
    rowY = doc.y;
    doc.text("Total hours worked", col1, rowY);
    doc.text(input.totalHours.toFixed(2), col2, rowY);
    doc.moveDown(0.8);

    rowY = doc.y;
    doc.fontSize(13);
    doc.text("Gross pay", col1, rowY);
    doc.text(money(input.grossPay), col4, rowY);
    doc.font("Helvetica").fontSize(11);

    doc.moveDown(3);
    doc.fontSize(9).fillColor("#777").text(
      `Generated automatically on ${new Date().toISOString().slice(0, 10)}. Hours are calculated from GPS+selfie verified clock-in/out records.`,
      { width: 495 },
    );

    doc.end();
  });
}
