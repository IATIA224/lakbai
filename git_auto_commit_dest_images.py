#!/usr/bin/env python3
"""
Automate creating a separate Git commit and push for every line added in a JSON file.

Usage:
    python git_auto_commit_dest_images.py [path/to/dest-images.json]

Behavior:
- Requires a Git repository.
- Requires a clean working tree except for the target file (no other uncommitted changes).
- Compares the target file in working tree against HEAD.
- For every line that appears as "added" in the working copy compared to HEAD, the script
  will create a sequence of commits. Each commit introduces one more added line (in the
  order they appear in the file) and pushes the commit to the current branch.
- The working file is restored to the final working content at the end.
"""
from __future__ import annotations
import argparse
import difflib
import os
import subprocess
import sys
from typing import List

def run_git(args: List[str], cwd: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git"] + args, cwd=cwd, text=True, capture_output=True, check=False)

def ensure_clean_except(repo_root: str, target_rel: str) -> None:
    # Ensure there are no uncommitted changes except possibly the target file
    proc = run_git(["status", "--porcelain"], cwd=repo_root)
    if proc.returncode != 0:
        raise RuntimeError(f"git status failed: {proc.stderr.strip()}")
    lines = [line for line in proc.stdout.splitlines() if line.strip()]
    others = []
    for line in lines:
        # Format: XY <path> (path may contain spaces)
        parts = line[3:]
        path = parts.strip()
        # Normalize paths
        path_norm = os.path.normpath(path)
        target_norm = os.path.normpath(target_rel)
        if path_norm != target_norm:
            others.append(path)
    if others:
        raise RuntimeError("Working tree has uncommitted changes outside the target file: " + ", ".join(others))

def get_repo_root(path: str) -> str:
    # Get git repo root for given path
    cwd = os.path.abspath(os.path.dirname(path)) or os.getcwd()
    proc = run_git(["rev-parse", "--show-toplevel"], cwd=cwd)
    if proc.returncode != 0:
        raise RuntimeError("Not inside a Git repository.")
    return proc.stdout.strip()

def read_file_lines_keepends(path: str) -> List[str]:
    with open(path, "rb") as f:
        data = f.read()
    # decode as utf-8 with replacement to avoid crashes on weird chars
    text = data.decode("utf-8", errors="replace")
    return text.splitlines(keepends=True)

def write_file_lines(path: str, lines: List[str]) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.writelines(lines)

def get_head_file_lines(repo_root: str, rel_path: str) -> List[str]:
    proc = run_git(["show", f"HEAD:{rel_path}"], cwd=repo_root)
    if proc.returncode != 0:
        # file probably doesn't exist in HEAD
        return []
    content = proc.stdout
    return content.splitlines(keepends=True)

def build_is_added_flags(head_lines: List[str], target_lines: List[str]) -> List[bool]:
    sm = difflib.SequenceMatcher(a=head_lines, b=target_lines, autojunk=False)
    is_added = [False] * len(target_lines)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag in ("insert", "replace"):
            for j in range(j1, j2):
                is_added[j] = True
        # deletions and equals leave is_added False for target positions
    return is_added

def safe_run(cmd: List[str], cwd: str) -> None:
    proc = subprocess.run(cmd, cwd=cwd)
    if proc.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}")

def main():
    parser = argparse.ArgumentParser(description="Commit and push one commit per added line in a file.")
    parser.add_argument("file", nargs="?", default="src/dest-images.json", help="Path to dest-images.json")
    args = parser.parse_args()

    target_path = os.path.abspath(args.file)
    if not os.path.exists(target_path):
        print(f"Target file not found: {target_path}", file=sys.stderr)
        sys.exit(1)

    repo_root = get_repo_root(target_path)
    # Path relative to repo root
    rel_path = os.path.relpath(target_path, repo_root).replace("\\", "/")

    # Ensure no other uncommitted changes
    try:
        ensure_clean_except(repo_root, rel_path)
    except RuntimeError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)

    # Read target (working) and head versions
    target_lines = read_file_lines_keepends(target_path)
    head_lines = get_head_file_lines(repo_root, rel_path)

    # Determine which lines are added in target compared to HEAD
    is_added = build_is_added_flags(head_lines, target_lines)
    added_indices = [i for i, v in enumerate(is_added) if v]

    if not added_indices:
        print("No added lines detected compared to HEAD. Nothing to do.")
        return

    # Save final content to restore at the end
    final_lines = target_lines.copy()

    # Overwrite working file with HEAD version to start building commits incrementally
    write_file_lines(target_path, head_lines)

    # Ensure file staged state is clean
    safe_run(["git", "checkout", "--", rel_path], cwd=repo_root)  # restore the file in working tree to HEAD (no-op if we wrote it)

    total = len(added_indices)
    # We'll include added lines in target order. Build an inclusion set for first k additions.
    for k in range(1, total + 1):
        # Build new intermediate content: include non-added lines, and the first k added lines
        included_count = 0
        include_until = set(added_indices[:k])
        new_lines: List[str] = []
        for idx, line in enumerate(target_lines):
            if is_added[idx]:
                if idx in include_until:
                    new_lines.append(line)
                    included_count += 1
                else:
                    # skip this added line for now
                    continue
            else:
                new_lines.append(line)
        # Write intermediate file
        write_file_lines(target_path, new_lines)
        # Stage, commit, and push
        try:
            safe_run(["git", "add", rel_path], cwd=repo_root)
            snippet = ""
            # Use the k-th added line for snippet (first k added_lines last one)
            add_idx = added_indices[k - 1]
            snippet = target_lines[add_idx].strip()
            if len(snippet) > 72:
                snippet = snippet[:69] + "..."
            commit_msg = f"Add line {k}/{total} to {rel_path}: {snippet}"
            safe_run(["git", "commit", "-m", commit_msg], cwd=repo_root)
            # Push the commit
            safe_run(["git", "push"], cwd=repo_root)
            print(f"Committed and pushed {k}/{total}.")
        except Exception as e:
            print(f"Failed at commit {k}: {e}", file=sys.stderr)
            # Try to restore final content before exiting
            write_file_lines(target_path, final_lines)
            sys.exit(1)

    # Restore final content (in case of formatting or newline differences)
    write_file_lines(target_path, final_lines)
    # Stage final file to ensure working tree matches what user had
    safe_run(["git", "add", rel_path], cwd=repo_root)
    # Do not create an extra commit here: all changes should have been committed already.
    print("All added lines committed and pushed. Working file restored to final content.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)