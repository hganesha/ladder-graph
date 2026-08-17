mod paths;
mod server;
mod sync;

use anyhow::{Context, Result};
use paths::AppPaths;
use rmcp::{ServiceExt, transport::stdio};
use server::LadderGraphServer;
use std::net::SocketAddr;
use tracing_subscriber::EnvFilter;

const DEFAULT_BIND: &str = "127.0.0.1:7341";

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive(tracing::Level::INFO.into()))
        .with_writer(std::io::stderr)
        .with_ansi(false)
        .init();

    let paths = AppPaths::discover()?;
    let arguments = std::env::args().skip(1).collect::<Vec<_>>();
    match arguments.first().map(String::as_str).unwrap_or("stdio") {
        "stdio" => run_stdio(paths).await,
        "serve" => run_serve(paths, &arguments[1..]).await,
        "pair" => {
            let code = sync::create_pairing_code(&paths)?;
            println!("{code}");
            eprintln!("Pairing code expires in five minutes.");
            Ok(())
        }
        "status" => {
            println!("{}", serde_json::to_string_pretty(&sync::status(&paths)?)?);
            Ok(())
        }
        "revoke" => {
            sync::revoke(&paths)?;
            println!("Revoked all browser pairings.");
            Ok(())
        }
        "doctor" => doctor(paths),
        "help" | "--help" | "-h" => {
            print_help();
            Ok(())
        }
        command => anyhow::bail!("unknown command {command}; run ladder-graph-mcp help"),
    }
}

async fn run_stdio(paths: AppPaths) -> Result<()> {
    paths.ensure()?;
    let service = LadderGraphServer::new(paths.snapshot)
        .serve(stdio())
        .await
        .inspect_err(|error| tracing::error!(%error, "MCP stdio server failed to start"))?;
    service.waiting().await?;
    Ok(())
}

async fn run_serve(paths: AppPaths, arguments: &[String]) -> Result<()> {
    let mut bind = DEFAULT_BIND.parse::<SocketAddr>()?;
    let mut origins = vec![
        "http://localhost:5173".to_string(),
        "http://127.0.0.1:5173".to_string(),
    ];
    let mut index = 0;
    while index < arguments.len() {
        match arguments[index].as_str() {
            "--bind" => {
                index += 1;
                bind = arguments
                    .get(index)
                    .context("--bind requires an address")?
                    .parse()?;
                if !bind.ip().is_loopback() {
                    anyhow::bail!("the sync service may bind only to a loopback address");
                }
            }
            "--allow-origin" => {
                index += 1;
                origins.push(
                    arguments
                        .get(index)
                        .context("--allow-origin requires an origin")?
                        .clone(),
                );
            }
            value => anyhow::bail!("unknown serve option {value}"),
        }
        index += 1;
    }
    sync::serve(paths, bind, origins).await
}

fn doctor(paths: AppPaths) -> Result<()> {
    paths.ensure()?;
    let catalog = ladder_catalog::Catalog::load(Some(&paths.snapshot))?;
    println!("data directory: {}", paths.data_dir.display());
    println!("built-in and user resources: {}", catalog.entries().len());
    println!("snapshot readable: {}", paths.snapshot.exists());
    println!("browser pairing configured: {}", paths.auth.exists());
    println!("status: ok");
    Ok(())
}

fn print_help() {
    println!(
        "Ladder Graph MCP\n\n\
         Usage:\n  \
         ladder-graph-mcp stdio\n  \
         ladder-graph-mcp serve [--bind 127.0.0.1:7341] [--allow-origin ORIGIN]\n  \
         ladder-graph-mcp pair\n  \
         ladder-graph-mcp status\n  \
         ladder-graph-mcp revoke\n  \
         ladder-graph-mcp doctor"
    );
}
