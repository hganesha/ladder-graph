use serde_json::{Value, json};
use std::{
    io::{BufRead, BufReader, Write},
    process::{Command, Stdio},
};

fn response_with_id(reader: &mut BufReader<impl std::io::Read>, id: i64) -> Value {
    loop {
        let mut line = String::new();
        reader.read_line(&mut line).expect("read MCP response");
        assert!(!line.is_empty(), "MCP server closed before response {id}");
        let value: Value = serde_json::from_str(&line).expect("valid MCP JSON response");
        if value.get("id").and_then(Value::as_i64) == Some(id) {
            return value;
        }
    }
}

fn send(writer: &mut impl Write, value: Value) {
    writeln!(writer, "{}", serde_json::to_string(&value).unwrap()).unwrap();
    writer.flush().unwrap();
}

#[test]
fn stdio_protocol_keeps_legacy_workflow_tools_and_adds_bundle_tools() {
    let directory = tempfile::tempdir().unwrap();
    let mut child = Command::new(env!("CARGO_BIN_EXE_ladder-graph-mcp"))
        .arg("stdio")
        .env("LADDER_GRAPH_MCP_DATA_DIR", directory.path())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("start MCP stdio server");
    let mut writer = child.stdin.take().unwrap();
    let mut reader = BufReader::new(child.stdout.take().unwrap());

    send(
        &mut writer,
        json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": { "name": "compatibility-test", "version": "1.0.0" }
            }
        }),
    );
    let initialized = response_with_id(&mut reader, 1);
    assert!(initialized.get("result").is_some(), "{initialized}");
    send(
        &mut writer,
        json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }),
    );

    send(
        &mut writer,
        json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {} }),
    );
    let tools = response_with_id(&mut reader, 2);
    let names = tools["result"]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|tool| tool["name"].as_str())
        .collect::<Vec<_>>();
    for expected in [
        "get_workflow",
        "validate_workflow",
        "compile_workflow",
        "validate_artifact",
        "compile_workflow_bundle",
    ] {
        assert!(names.contains(&expected), "missing {expected}: {names:?}");
    }

    send(
        &mut writer,
        json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "get_workflow",
                "arguments": { "identifier": "refinement", "scope": "builtin", "format": "source-yaml" }
            }
        }),
    );
    let legacy = response_with_id(&mut reader, 3);
    assert_eq!(legacy["result"]["isError"], false, "{legacy}");
    assert!(legacy.to_string().contains("refinement"));

    send(
        &mut writer,
        json!({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "compile_workflow_bundle",
                "arguments": { "identifier": "insurance-claim-review", "scope": "builtin", "target": "typescript" }
            }
        }),
    );
    let bundle = response_with_id(&mut reader, 4);
    assert_eq!(bundle["result"]["isError"], false, "{bundle}");
    assert!(bundle.to_string().contains("ladder.lock.json"));

    drop(writer);
    let _ = child.kill();
    let _ = child.wait();
}
