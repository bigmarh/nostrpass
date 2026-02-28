export function Spinner(props: { size?: string; color?: string }) {
  const size = props.size ?? 'w-4 h-4';
  const color = props.color ?? 'border-white';
  return (
    <span
      class={`inline-block ${size} rounded-full border-2 ${color} border-t-transparent animate-spin`}
      aria-hidden="true"
    />
  );
}
