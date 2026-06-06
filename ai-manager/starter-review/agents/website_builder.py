from tools.file_tools import list_project_files, read_text_file


def inspect_website(root: str = "website") -> dict:
    files = list_project_files(root)
    sample = []
    for path in files[:10]:
        sample.append({
            "path": str(path),
            "chars_sampled": len(read_text_file(path, max_chars=2000))
        })
    return {
        "file_count": len(files),
        "sample_files": sample
    }
