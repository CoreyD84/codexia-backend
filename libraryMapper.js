// libraryMapper.js
const LIBRARY_MAP = {
    "Retrofit": {
        import: "import Alamofire",
        pattern: /@GET\((.*)\)\s+suspend\s+fun\s+(\w+)\(.*\)/,
        replacement: (match) => `func ${match[2]}() async throws -> Response`
    },
    "Firebase": {
        import: "import FirebaseFirestore",
        pattern: /FirebaseFirestore\.getInstance\(\)/,
        replacement: "Firestore.firestore()"
    }
    // Add more "Recipes" here as you scale
};

module.exports = { LIBRARY_MAP };
