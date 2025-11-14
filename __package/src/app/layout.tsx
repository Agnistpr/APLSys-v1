import "../../../styles.css"; // Adjust path as needed for your structure
import { Analytics } from "@vercel/analytics/react";

export const metadata = {
  title: "APLSys Smart Candidate Screener",
  description:
    "The Smart Candidate Screener is a powerful AI tool for analyzing resumes against job descriptions. It also provides a resume parser to easily extract an applicant's info.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
