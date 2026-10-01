import { UploadFlow } from "@/components/upload-flow";
export const metadata = { title: "Upload CV" };
export default function UploadPage() {
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Upload a CV</h1>
          <p>
            One upload is scored for both roles. Keep this page open until it
            finishes.
          </p>
        </div>
      </header>
      <UploadFlow />
    </>
  );
}
