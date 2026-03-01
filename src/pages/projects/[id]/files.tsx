import fs from "node:fs";
import path from "node:path";
import { GetServerSideProps } from "next";
import { useState } from "react";

interface FileNode { path: string; name: string; content?: string }

export default function FilesPage({ files, outputPath }: { files: FileNode[]; outputPath: string }) {
  const [selected, setSelected] = useState<FileNode | null>(files[0] ?? null);

  return (
    <main className="grid gap-4 md:grid-cols-[320px_1fr]">
      <div className="rounded border border-slate-800 bg-slate-900/60 p-3 space-y-2">
        <div className="text-xs text-slate-400">{outputPath}</div>
        {files.map((file) => (
          <button key={file.path} className="block w-full rounded border border-slate-800 p-2 text-left text-sm hover:border-slate-600" onClick={() => setSelected(file)}>
            {file.name}
          </button>
        ))}
      </div>
      <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
        <div className="mb-2 text-xs text-slate-400 break-all">{selected?.path}</div>
        <button className="mb-3 rounded border border-slate-700 px-2 py-1 text-xs" onClick={() => navigator.clipboard.writeText(selected?.path ?? "")}>Copy path</button>
        <pre className="max-h-[70vh] overflow-auto text-xs text-slate-200">{selected?.content ?? "No preview"}</pre>
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const projectId = ctx.params?.id as string;
  const projectRes = await fetch(`http://127.0.0.1:4000/api/projects/${projectId}`);

  if (!projectRes.ok) {
    return { props: { files: [], outputPath: "unknown" } };
  }

  const { project } = (await projectRes.json()) as { project: { outputPath: string } };
  const target = project.outputPath;
  const files: FileNode[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const rel = path.relative(target, full);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else {
        let content = "";
        try {
          content = fs.readFileSync(full, "utf-8").slice(0, 20000);
        } catch {
          content = "<binary or unreadable file>";
        }
        files.push({ path: full, name: rel, content });
      }
    }
  };

  if (target && fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    walk(target);
  }

  return { props: { files, outputPath: target } };
};
