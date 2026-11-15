import { Outlet } from 'react-router';

// Carcasa mínima: solo el hueco de contenido. La disposición con menú y barras es de W4.
export function Carcasa() {
  return (
    <main className="min-h-dvh">
      <Outlet />
    </main>
  );
}
