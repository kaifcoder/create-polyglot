export const metadata = {
  title: 'Frontend Service',
  description: 'Scaffolded by create-polyglot',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{margin:0,fontFamily:'sans-serif'}}>{children}</body>
    </html>
  );
}
