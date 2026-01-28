export default function Page() {
  return (
    <pre>
      API: {process.env.NEXT_PUBLIC_API_URL ?? "UNDEFINED"}
    </pre>
  );
}
