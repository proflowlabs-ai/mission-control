import fs from "node:fs";
import path from "node:path";
import { GetServerSideProps } from "next";
import { useState } from "react";

interface FileNode { path: string; name: string; content?: string }

export default function FilesPage({ files }: { files: FileNode[] }) {
  const [selected, setSelected] = useState<FileNode | null>(files[0] ?? null);

  return (
    <main className="p-6 grid md:grid-cols-[280px_1fr] gap-4">
      <div className="rounded border p-3 space-y-2">
        {files.map((file) => (
          <button key={file.path} className="block text-left text-sm underline" onClick={() => setSelected(file)}>{file.name}</button>
        ))}
      </div>
      <div className="rounded border p-3">
        <div className="mb-2 text-xs text-muted-foreground">{selected?.path}</div>
        <button className="mb-2 border rounded px-2 py-1 text-xs" onClick={() => navigator.clipboard.writeText(selected?.path ?? "")}>Copy path</button>
        <pre className="text-xs overflow-auto max-h-[70vh]">{selected?.content ?? "No preview"}</pre>
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  const target = "/tmp/test/out";
  const files: FileNode[] = [];

  if (fs.existsSync(target)) {
    for (const entry of fs.readdirSync(target)) {
      const full = path.join(target, entry);
      if (fs.statSync(full).isFile()) {
        files.push({ path: full, name: entry, content: fs.readFileSync(full, "utf-8") });
      }
    }
  }

  return { props: { files } };
};
