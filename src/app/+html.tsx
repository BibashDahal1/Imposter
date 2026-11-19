import type { PropsWithChildren } from "react";
import {
  ScrollViewStyleReset,
  useServerDocumentContext,
} from "expo-router/html";

export default function RootHtml({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } =
    useServerDocumentContext();

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <ScrollViewStyleReset />
        {headNodes}
        <style>{`
          html, body, #root {
            min-height: 100%;
            margin: 0;
            background: #000000;
          }
          body {
            overflow: hidden;
          }
        `}</style>
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
