export async function GET() {
  const now = new Date();
  return Response.json({
    date: now.toISOString()
  });
}
