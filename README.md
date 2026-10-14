# Fluid

Interaktywna rzeźba WebGL: ruch kursora lub palca rozciąga organiczną kulę w skręconą wstęgę. Po zatrzymaniu forma płynnie wraca do spoczynku. Materiał wykorzystuje odbicia studyjne, transmisję, iryzację i powłokę clearcoat. Cała geometria, oświetlenie i tekstury powstają lokalnie.

## Uruchomienie

Wymagany Node.js 22.12+ lub 24 oraz npm. Pobierz repozytorium (Code → Download ZIP), rozpakuj archiwum i otwórz terminal w katalogu nadrzędnym folderu projektu. Możesz też sklonować repozytorium poleceniem `git clone https://github.com/Kochman-k/fluid-shape.git`.

```sh
cd fluid-shape
npm ci
npm run dev -- --port 5173
```

Po uruchomieniu otwórz w przeglądarce adres podany w terminalu, zwykle `http://localhost:5173`. Pozostaw terminal otwarty. Ctrl+C zatrzymuje aplikację.

`npm run build` tworzy produkcyjną wersję w `dist/`. `npm run preview` uruchamia podgląd kompilacji.

## Sterowanie

- Poruszaj kursorem po scenie lub przesuwaj palcem na ekranie dotykowym.
- Opal, Rose i Chrome zmieniają wygląd powierzchni.
- Przezroczystość reguluje transmisję materiału; Chrome zachowuje metaliczny charakter.
- Płynność określa czas reakcji i powrotu do kuli.
- Pauza zatrzymuje animację; reset przywraca ustawienia.
- Narzędzia poniżej sceny losują kształt, zapisują PNG sceny i włączają pełny ekran, jeśli przeglądarka go obsługuje.

Animacja respektuje `prefers-reduced-motion`. Wymagana przeglądarka z WebGL 2. Fonty są dołączone lokalnie; aplikacja nie wymaga API, kluczy ani zdalnych zasobów.

## Weryfikacja

```sh
npm run build
npm test
```

Testy Playwright sprawdzają renderowanie WebGL, przejście kula–wstęga–kula, materiały, suwaki, pauzę, reset, okno informacji, pobieranie PNG i układ mobilny z dotykiem. Domyślnie używają `/usr/bin/chromium`; inną przeglądarkę można wskazać przez `CHROMIUM_PATH`. Testy używają programowego renderowania WebGL w środowisku cloud. Serwer deweloperski uruchamia się automatycznie, jeśli nie działa.

Inspiracja: [Blobmixer / 14islands](https://blobmixer.14islands.com/).
