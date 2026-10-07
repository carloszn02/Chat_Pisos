import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * The HTML page around the web version of the app (only used on the web).
 * Sets the description shown by search engines and link previews,
 * and a cream background so there is no white flash while the app loads.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta
          name="description"
          content="Encuentra habitación, piso o compañeros de piso en Madrid. Chats por barrio, anuncios con mapa y mensajes privados. / Find a room, a flat or flatmates in Madrid."
        />
        <meta name="theme-color" content="#FBF8F4" />
        <meta property="og:title" content="Chat Pisos" />
        <meta
          property="og:description"
          content="Habitaciones, pisos y compañeros de piso en Madrid, organizados por barrios."
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'html, body { background-color: #FBF8F4; }' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
