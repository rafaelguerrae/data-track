import Image from "next/image";

const RATIO = 1028 / 574; // proporção de public/data-track.png

/** Logo completa. `height` em px; a largura segue a proporção da imagem. */
export function Brand({ height = 44, className = "" }: { height?: number; className?: string }) {
  return (
    <Image
      src="/data-track.png"
      alt="Data Track"
      width={Math.round(height * RATIO)}
      height={height}
      priority
      // O fundo branco da imagem se funde com a cor da página.
      className={`mix-blend-multiply ${className}`}
    />
  );
}
