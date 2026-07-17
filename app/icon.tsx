import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#16a34a",
        }}
      >
        <div
          style={{
            width: "60%",
            height: "60%",
            borderRadius: "50%",
            background: "#e4f24a",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
