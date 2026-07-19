<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Convenzioni responsive

- **Breakpoint**: default Tailwind v4 (nessun override) — `sm`=640px, `md`=768px, `lg`=1024px (soglia usata da sidebar/mobile-header), `xl`=1280px.
- **Griglie di campi**: mai `grid-cols-N` fisso per form/dettagli. Mobile-first: `grid-cols-1 sm:grid-cols-2` per 2 campi, `grid-cols-1 sm:grid-cols-3` per 3 campi. Riferimento: `app/(protected)/dashboard/page.tsx`, `app/(protected)/account/page.tsx`.
- **Tabelle dati + dialoghi**: niente componente tabella generico. Ogni manager (`*-manager.tsx`) mantiene la `<Table>` esistente nascosta sotto la soglia scelta (`hidden lg:block` o `hidden md:block` a seconda della densità colonne) e affianca un blocco card impilate (`lg:hidden`/`md:hidden`) generato dalla stessa `.map()`, sullo stesso pattern già usato da `sidebar.tsx`/`mobile-header.tsx` (stesso contenuto, visibilità alternata via classi).
- **Dialoghi**: `components/ui/dialog.tsx` vincola già l'altezza di `DialogContent` e rende `DialogFooter` sticky in fondo — non serve altro fix per contenuti lunghi o zoom del browser elevato.
