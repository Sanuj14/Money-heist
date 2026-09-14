import BoardClient from "./BoardClient";

export default function BoardPage({ params }: { params: { code: string } }) {
  return <BoardClient code={params.code.toUpperCase()} />;
}
