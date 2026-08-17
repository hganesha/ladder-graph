use anyhow::{Context, Result};
use directories::ProjectDirs;
use std::{fs, path::PathBuf};

#[derive(Debug, Clone)]
pub struct AppPaths {
    pub data_dir: PathBuf,
    pub snapshot: PathBuf,
    pub auth: PathBuf,
}

impl AppPaths {
    pub fn discover() -> Result<Self> {
        let data_dir = if let Some(override_path) = std::env::var_os("LADDER_GRAPH_MCP_DATA_DIR") {
            PathBuf::from(override_path)
        } else {
            let project = ProjectDirs::from("dev", "Ladder Graph", "Ladder Graph MCP")
                .context("the operating system did not provide an application-data directory")?;
            project.data_local_dir().to_path_buf()
        };
        Ok(Self {
            snapshot: data_dir.join("catalog-v1.json"),
            auth: data_dir.join("auth-v1.json"),
            data_dir,
        })
    }

    pub fn ensure(&self) -> Result<()> {
        fs::create_dir_all(&self.data_dir)
            .with_context(|| format!("create {}", self.data_dir.display()))?;
        set_private_permissions(&self.data_dir)?;
        Ok(())
    }
}

pub fn set_private_permissions(path: &std::path::Path) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = if path.is_dir() { 0o700 } else { 0o600 };
        fs::set_permissions(path, fs::Permissions::from_mode(mode))?;
    }
    Ok(())
}
