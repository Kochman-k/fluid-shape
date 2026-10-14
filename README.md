# Fluid

Interaktywna rzeźba WebGL: ruch kursora lub palca rysuje skręconą wstęgę po rzeczywistym torze ruchu. Jej początek podąża za kursorem, a starsze fragmenty pozostają w ogonie jak ślad szklanego pędzla. Po zatrzymaniu ślad wyhamowuje i zbiera się w organiczną kulę w pobliżu końca gestu. Szybkie gesty zachowują więcej bezwładności: ogon pozostaje widoczny podczas formowania sfery, zamiast najpierw znikać w cienką kreskę. Materiał wykorzystuje odbicia studyjne, transmisję, iryzację i powłokę clearcoat. Cała geometria, oświetlenie i tekstury powstają lokalnie.

## Uruchomienie

Wymagany Node.js 22.12+ lub 24 oraz npm. Pobierz repozytorium (Code → Download ZIP), rozpakuj archiwum i otwórz terminal w katalogu nadrzędnym folderu projektu. Możesz też sklonować repozytorium poleceniem `git clone https://github.com/Kochman-k/fluid-shape.git`.

```sh
cd fluid-shape
npm ci
npm run dev -- --port 5173
```

Po uruchomieniu otwórz w przeglądarce adres podany w terminalu, zwykle `http://localhost:5173`. Pozostaw terminal otwarty. Ctrl+C zatrzymuje aplikację.

`npm run build` tworzy produkcyjną wersję w `dist/`. `npm run preview` uruchamia podgląd kompilacji.

## Podgląd online — GitHub Pages

Aplikacja jest przygotowana do publikacji pod adresem https://kochman-k.github.io/fluid-shape/.

Jednorazowo w repozytorium otwórz **Settings → Pages → Build and deployment → Source** i wybierz **GitHub Actions**. Następnie w **Actions → Publish to GitHub Pages → Run workflow** uruchom publikację dla gałęzi `main`. Po pomyślnym zakończeniu zadania `deploy` otwórz adres strony. Jeśli GitHub wymaga zatwierdzenia środowiska `github-pages`, zatwierdź wdrożenie w zakładce Actions.

Kolejne zmiany na `main` publikują się automatycznie. Wdrożenie ustawia źródło Pages na GitHub Actions i sprawdza publiczny HTML oraz dostępność skryptu i arkusza stylów. Dzięki temu publikacja surowych plików projektu nie przechodzi kontroli gotowości. Workflow instaluje zależności z lockfile, kompiluje aplikację i wdraża `dist/` przez oficjalne akcje GitHub Pages. Konfiguracja Vite dodaje do kompilacji ścieżkę `/fluid-shape/`, aby skrypty i fonty działały na stronie repozytorium. Serwer deweloperski zachowuje ścieżkę `/`.

Jeśli Pages nie jest dostępne dla prywatnego repozytorium w Twoim planie GitHub, potrzebny jest plan obsługujący tę funkcję albo osobna decyzja o upublicznieniu repozytorium.

## Sterowanie

- Poruszaj kursorem po scenie lub przesuwaj palcem na ekranie dotykowym.
- Opal, Rose i Chrome zmieniają wygląd powierzchni.
- Przezroczystość reguluje transmisję materiału; Chrome zachowuje metaliczny charakter.
- Płynność określa długość pamięci śladu i łagodność reakcji.
- Pauza zatrzymuje animację; reset przywraca ustawienia.
- Narzędzia poniżej sceny losują kształt, zapisują PNG sceny i włączają pełny ekran, jeśli przeglądarka go obsługuje.

Animacja respektuje `prefers-reduced-motion`. Wymagana przeglądarka z WebGL 2. Fonty są dołączone lokalnie; aplikacja nie wymaga API, kluczy ani zdalnych zasobów.

## Weryfikacja

```sh
npm run build
npm test
```

Testy jednostkowe sprawdzają zachowanie zakrętów w śladzie, rozpoczęcie nowego gestu po spoczynku oraz ograniczenie pamięci historii. Testy Playwright sprawdzają renderowanie WebGL, przejście kula–wstęga–kula, materiały, suwaki, pauzę, reset, okno informacji, pobieranie PNG i układ mobilny z dotykiem. Domyślnie używają `/usr/bin/chromium`; inną przeglądarkę można wskazać przez `CHROMIUM_PATH`. Testy używają programowego renderowania WebGL w środowisku cloud. Serwer deweloperski uruchamia się automatycznie, jeśli nie działa.

Inspiracja: [Blobmixer / 14islands](https://blobmixer.14islands.com/).
