from backend.database import SessionLocal, Character

def clean_database():
    db = SessionLocal()
    chars = db.query(Character).all()
    for char in chars:
        if char.tweet_history:
            lines = [l.strip() for l in char.tweet_history.split("\n") if l.strip()]
            cleaned = []
            for line in lines:
                if line in ("----", "====", ">", "New Post:"):
                    continue
                if line.startswith("@") or line.startswith("*"):
                    continue
                if line.lower() == char.name.lower():
                    continue
                if "Only write the content" in line or "(Only write" in line:
                    continue
                # strip out leading/trailing formatting characters
                line = line.strip('"-* ')
                if line:
                    cleaned.append(line)
            char.tweet_history = "\n".join(cleaned) + "\n"
            print(f"Cleaned history for {char.name}: {len(cleaned)} lines")
    db.commit()
    db.close()

if __name__ == '__main__':
    clean_database()
