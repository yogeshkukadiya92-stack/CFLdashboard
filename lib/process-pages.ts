export type ProcessFieldType = "date" | "file" | "number" | "select" | "text" | "textarea";

export type ProcessField = {
  key: string;
  label: string;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  type: ProcessFieldType;
};

export type ProcessPageConfig = {
  actionLabel: string;
  description: string;
  fields: ProcessField[];
  tableColumns: string[];
  title: string;
};

export const processPageConfigs: Record<string, ProcessPageConfig> = {
  "client-batch-transfer": {
    actionLabel: "Save Transfer",
    description: "Move selected clients from one workshop batch to another with remarks and audit-ready tracking.",
    fields: [
      { key: "client", label: "Search Client By Name or Mobile No", placeholder: "Search by keyword", required: true, type: "text" },
      { key: "fromBatch", label: "Select Workshop Batch", options: [], required: true, type: "select" },
      { key: "toBatch", label: "Transfer to Batch", options: [], required: true, type: "select" },
      { key: "remarks", label: "Remarks", placeholder: "Reason for batch transfer", type: "textarea" }
    ],
    tableColumns: ["Client", "From Batch", "To Batch", "Status", "Updated At"],
    title: "Client Batch Transfer"
  },
  refund: {
    actionLabel: "Issue Refund",
    description: "Review payment details and process refund requests for registered clients.",
    fields: [
      { key: "client", label: "Client Name / Mobile", placeholder: "Search client", required: true, type: "text" },
      { key: "paymentId", label: "Razorpay Payment ID", placeholder: "pay_xxxxx", required: true, type: "text" },
      { key: "amount", label: "Refund Amount", placeholder: "0", required: true, type: "number" },
      { key: "reason", label: "Refund Reason", placeholder: "Reason for refund", type: "textarea" }
    ],
    tableColumns: ["Client", "Amount", "Payment ID", "Refund Status", "Requested At"],
    title: "Refund"
  },
  "import-data-workshop-wise": {
    actionLabel: "Upload Data",
    description: "Import workshop-wise registrations or member records using a structured CSV file.",
    fields: [
      { key: "workshop", label: "Select Workshop", options: [], required: true, type: "select" },
      { key: "source", label: "Import Source", options: ["CSV", "Excel", "Google Sheet"], required: true, type: "select" },
      { key: "file", label: "Upload File", required: true, type: "file" },
      { key: "notes", label: "Import Notes", placeholder: "Optional notes", type: "textarea" }
    ],
    tableColumns: ["Workshop", "File", "Rows", "Import Status", "Uploaded At"],
    title: "Import Data Workshop Wise"
  },
  "merge-client": {
    actionLabel: "Merge Client",
    description: "Find duplicate client records and merge them into one clean profile.",
    fields: [
      { key: "primaryClient", label: "Primary Client", placeholder: "Search primary client", required: true, type: "text" },
      { key: "duplicateClient", label: "Duplicate Client", placeholder: "Search duplicate client", required: true, type: "text" },
      { key: "mergeRule", label: "Merge Rule", options: ["Keep latest payment", "Keep primary details", "Manual review"], required: true, type: "select" },
      { key: "remarks", label: "Remarks", placeholder: "Merge reason", type: "textarea" }
    ],
    tableColumns: ["Primary Client", "Duplicate Client", "Rule", "Status", "Merged At"],
    title: "Merge Client"
  },
  "apply-coupon": {
    actionLabel: "Apply Coupon",
    description: "Apply coupon benefits to selected clients or workshop registrations.",
    fields: [
      { key: "client", label: "Client / Mobile", placeholder: "Search client", required: true, type: "text" },
      { key: "workshop", label: "Workshop", options: [], required: true, type: "select" },
      { key: "coupon", label: "Coupon Code", placeholder: "WELCOME10", required: true, type: "text" },
      { key: "discount", label: "Discount Value", placeholder: "0", type: "number" }
    ],
    tableColumns: ["Client", "Workshop", "Coupon", "Discount", "Applied At"],
    title: "Apply Coupon"
  },
  "re-check-failed-payment": {
    actionLabel: "Re-Check Payment",
    description: "Recheck failed payments and update payment status after gateway verification.",
    fields: [
      { key: "client", label: "Client / Mobile", placeholder: "Search client", required: true, type: "text" },
      { key: "orderId", label: "Order ID", placeholder: "order_xxxxx", required: true, type: "text" },
      { key: "gateway", label: "Gateway", options: ["Razorpay", "Manual", "UPI"], required: true, type: "select" },
      { key: "remarks", label: "Remarks", placeholder: "Verification notes", type: "textarea" }
    ],
    tableColumns: ["Client", "Order ID", "Gateway", "Payment Status", "Checked At"],
    title: "Re-Check Failed Payment"
  },
  "manual-client-registration": {
    actionLabel: "Register Client",
    description: "Manually register a client into a workshop when payment or enrollment is handled offline.",
    fields: [
      { key: "client", label: "Client Name", placeholder: "Full name", required: true, type: "text" },
      { key: "mobile", label: "Mobile", placeholder: "+91", required: true, type: "text" },
      { key: "workshop", label: "Workshop", options: [], required: true, type: "select" },
      { key: "batch", label: "Batch", options: [], required: true, type: "select" }
    ],
    tableColumns: ["Client", "Mobile", "Workshop", "Batch", "Registered At"],
    title: "Manual Client Registration"
  },
  "manual-client-part-payment": {
    actionLabel: "Add Part Payment",
    description: "Record partial payments for clients and keep collection follow-up clean.",
    fields: [
      { key: "client", label: "Client / Mobile", placeholder: "Search client", required: true, type: "text" },
      { key: "workshop", label: "Workshop", options: [], required: true, type: "select" },
      { key: "amount", label: "Part Payment Amount", placeholder: "0", required: true, type: "number" },
      { key: "dueDate", label: "Next Due Date", type: "date" }
    ],
    tableColumns: ["Client", "Workshop", "Amount", "Next Due Date", "Recorded At"],
    title: "Manual Client Part Payment"
  }
};

export const processPageLinks = Object.entries(processPageConfigs).map(([slug, config]) => ({
  href: `/process/${slug}`,
  label: config.title
}));
