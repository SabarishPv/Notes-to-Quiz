import { IconBolt } from "./Icons";

export default function LogoMark({ size = 54 }) {
  return (
    <span className="logo-mark" aria-hidden="true" style={{ width: size, height: size }}>
      <IconBolt width={size * 0.5} height={size * 0.5} />
    </span>
  );
}
