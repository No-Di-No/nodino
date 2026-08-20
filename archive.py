import os
import shutil
from datetime import datetime

# ============================================================
# CONFIGURAZIONE
# ============================================================

# Cartella principale (dove si trova archive.py)
base_folder = os.path.dirname(os.path.abspath(__file__))

# Cartella archivio
archivio_path = os.path.join(base_folder, "archivio")

# File contenente gli elementi da ignorare
ignore_file = os.path.join(base_folder, "ignore.txt")


# ============================================================
# LETTURA ignore.txt
# ============================================================

ignore_paths = set()

if os.path.isfile(ignore_file):
    with open(ignore_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()

            # Ignora righe vuote e commenti
            if not line or line.startswith("#"):
                continue

            # Normalizza il percorso
            path = os.path.abspath(
                os.path.normpath(
                    os.path.join(base_folder, line)
                )
            )

            ignore_paths.add(path)


# ============================================================
# FUNZIONE PER VERIFICARE SE UN PERCORSO È DA IGNORARE
# ============================================================

def should_ignore(path):
    path = os.path.abspath(os.path.normpath(path))

    # Il percorso stesso è nella lista
    if path in ignore_paths:
        return True

    # Controlla se il percorso si trova dentro
    # una cartella indicata in ignore.txt
    for ignored_path in ignore_paths:
        try:
            common = os.path.commonpath([path, ignored_path])

            if common == ignored_path:
                return True

        except ValueError:
            # Percorsi su unità diverse (Windows)
            pass

    return False


# ============================================================
# CREAZIONE CARTELLA ARCHIVIO
# ============================================================

timestamp = datetime.now().strftime("%Y-%m-%d %H-%M-%S")

dest_folder = os.path.join(
    archivio_path,
    timestamp
)

os.makedirs(dest_folder, exist_ok=True)


# ============================================================
# COPIA RICORSIVA
# ============================================================

def copy_item(source, destination):
    """
    Copia ricorsivamente file e cartelle.
    Mantiene i metadata dei file tramite copy2().
    """

    # Se l'elemento deve essere ignorato
    if should_ignore(source):
        print(f"Ignorato: {source}")
        return

    # Se è una cartella
    if os.path.isdir(source):

        # Crea la cartella di destinazione
        os.makedirs(destination, exist_ok=True)

        # Scorre il contenuto
        for item in os.listdir(source):

            source_item = os.path.join(source, item)
            destination_item = os.path.join(destination, item)

            copy_item(source_item, destination_item)

        # Copia i metadata della cartella
        shutil.copystat(source, destination)

    # Se è un file
    elif os.path.isfile(source):

        shutil.copy2(source, destination)


# ============================================================
# AVVIO ARCHIVIAZIONE
# ============================================================

for item in os.listdir(base_folder):

    source = os.path.join(base_folder, item)
    destination = os.path.join(dest_folder, item)

    # Non archiviare la cartella archivio
    if item == "archivio":
        continue

    # Copia l'elemento
    copy_item(source, destination)


print()
print("========================================")
print("        ARCHIVIAZIONE COMPLETATA")
print("========================================")
print(f"Archivio creato in:")
print(dest_folder)