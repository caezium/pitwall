import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_DIR = process.env.RECEIPT_DIR ?? path.resolve(process.cwd(), "public/receipts");

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const expenseId = formData.get("expenseId") as string | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `${expenseId ?? crypto.randomUUID()}.${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  const url = `/receipts/${filename}`;
  return Response.json({ url, filename });
}
