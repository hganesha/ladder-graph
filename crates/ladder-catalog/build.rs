use std::{env, fs, path::PathBuf};

fn main() {
    let crate_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("manifest dir"));
    let catalog_dir = crate_dir.join("../../catalog");
    println!("cargo:rerun-if-changed={}", catalog_dir.display());

    let mut files = Vec::new();
    for directory in [
        "workflows",
        "agents",
        "ontologies",
        "forms",
        "documents",
        "bundles",
    ] {
        let mut entries = fs::read_dir(catalog_dir.join(directory))
            .expect("read catalog directory")
            .map(|entry| entry.expect("read catalog entry").path())
            .filter(|path| {
                path.extension()
                    .is_some_and(|extension| extension == "yaml")
                    && !path
                        .file_stem()
                        .and_then(|value| value.to_str())
                        .is_some_and(|value| value.ends_with(" 2"))
            })
            .collect::<Vec<_>>();
        entries.sort();
        for path in entries {
            let relative = path
                .strip_prefix(&catalog_dir)
                .expect("catalog relative path");
            files.push((relative.to_string_lossy().replace('\\', "/"), path));
        }
    }

    let manifest = catalog_dir.join("manifest.json");
    let mut generated = format!(
        "pub static BUILTIN_MANIFEST: &str = include_str!({:?});\npub static BUILTIN_ASSETS: &[(&str, &str)] = &[\n",
        manifest.to_string_lossy(),
    );
    for (relative, absolute) in files {
        generated.push_str(&format!(
            "    ({relative:?}, include_str!({absolute:?})),\n",
            relative = relative,
            absolute = absolute.to_string_lossy(),
        ));
    }
    generated.push_str("];\n");
    fs::write(
        PathBuf::from(env::var("OUT_DIR").expect("out dir")).join("builtin_catalog.rs"),
        generated,
    )
    .expect("write built-in catalog source");
}
