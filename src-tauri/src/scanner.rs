/// Content-Type -> normalisierte Endung. None = nicht erlaubt.
pub fn ext_from_content_type(ct: &str) -> Option<&'static str> {
    let base = ct.split(';').next().unwrap_or("").trim().to_lowercase();
    match base.as_str() {
        "image/jpeg" => Some("jpg"),
        "image/png" => Some("png"),
        "application/pdf" => Some("pdf"),
        _ => None,
    }
}

/// Pfadteil einer Request-URL ("/upload?token=x" -> "/upload").
pub fn path_of(url: &str) -> &str {
    url.split('?').next().unwrap_or(url)
}

/// Token-Query-Parameter aus einer URL lesen.
pub fn parse_token(url: &str) -> Option<String> {
    let q = url.split('?').nth(1)?;
    for pair in q.split('&') {
        let mut it = pair.splitn(2, '=');
        if it.next() == Some("token") {
            return it.next().map(|s| s.to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ext_from_content_type_maps_known_types() {
        assert_eq!(ext_from_content_type("image/jpeg"), Some("jpg"));
        assert_eq!(ext_from_content_type("image/png; charset=binary"), Some("png"));
        assert_eq!(ext_from_content_type("application/pdf"), Some("pdf"));
        assert_eq!(ext_from_content_type("text/html"), None);
    }
    #[test]
    fn path_and_token_parsing() {
        assert_eq!(path_of("/upload?token=abc"), "/upload");
        assert_eq!(path_of("/scan"), "/scan");
        assert_eq!(parse_token("/upload?token=abc"), Some("abc".to_string()));
        assert_eq!(parse_token("/upload?x=1&token=zzz"), Some("zzz".to_string()));
        assert_eq!(parse_token("/upload"), None);
    }
}
