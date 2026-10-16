import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata = {title:"Diagnóstico RGS IA",description:"Descubra onde a IA realmente pode gerar resultado na sua operação."};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="pt-BR"><body>{children}</body></html>}