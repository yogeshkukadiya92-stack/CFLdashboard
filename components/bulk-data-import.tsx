"use client";

import { Menu, Upload, FileDown, UserCircle2 } from "lucide-react";
import { useState } from "react";

export function BulkDataImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function handleUpload() {
    if (!selectedFile || isUploading) {
      return;
    }
    setIsUploading(true);
    setTimeout(() => setIsUploading(false), 1400);
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <button className="rounded-md border border-gray-200 p-2 text-gray-600" type="button">
          <Menu className="size-5" />
        </button>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <UserCircle2 className="size-5" />
          Welcome Admin User
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Bulk Data Import</h1>
          <p className="mt-2 rounded-md bg-gray-50 p-3 text-sm font-semibold text-gray-700">
            Import Leads and Assign Sales Staff. Please download the sample format, fill your records,
            and upload to process entries in bulk.
          </p>

          <button
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
            type="button"
          >
            <FileDown className="size-4" />
            Download Sample File
          </button>

          <div className="mt-6 space-y-3">
            <label className="block text-sm font-medium text-gray-700">Choose File</label>
            <input
              className="block w-full rounded-md border border-gray-300 p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            {selectedFile ? <p className="text-xs text-gray-500">Selected: {selectedFile.name}</p> : null}
            <button
              className="inline-flex items-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-60"
              disabled={!selectedFile || isUploading}
              onClick={handleUpload}
              type="button"
            >
              <Upload className="size-4" />
              {isUploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </section>
      </main>

      <footer className="sticky bottom-0 border-t border-gray-200 bg-white px-4 py-3 text-center text-xs text-gray-500">
        Copyright © 2026 CFL OS
      </footer>
    </div>
  );
}
