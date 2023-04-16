#ifdef SQLITE_API
#undef SQLITE_API
#endif
#define SQLITE_API __attribute__((visibility("default")))

// === Remove Deprecated ===
#define SQLITE_DQS 0
#define SQLITE_LIKE_DOESNT_MATCH_BLOBS
#define SQLITE_OMIT_DEPRECATED
#define SQLITE_OMIT_SHARED_CACHE
#define SQLITE_OMIT_TCL_VARIABLE
#define SQLITE_OMIT_TRACE
#define SQLITE_OMIT_UTF16


// === Required ===
#define SQLITE_OMIT_WAL 1
#define SQLITE_OMIT_LOAD_EXTENSION
#define SQLITE_OS_OTHER 1
#define SQLITE_THREADSAFE 1


// === Required by OPFS VFS ===
#define SQLITE_ENABLE_ATOMIC_WRITE
#define SQLITE_ENABLE_BATCH_ATOMIC_WRITE


// === Recommended ===
#define SQLITE_DEFAULT_FOREIGN_KEYS 1
#define SQLITE_USE_URI 1
#define SQLITE_ALLOW_URI_AUTHORITY


// === Optional - Adds features ===
#define SQLITE_ENABLE_RTREE 1
#define SQLITE_JSON1
#define SQLITE_ENABLE_FTS5
#define SQLITE_ENABLE_MATH_FUNCTIONS
// #define SQLITE_ENABLE_NORMALIZE
// #define SQLITE_ENABLE_GEOPOLY
// #define SQLITE_ENABLE_DBSTAT_VTAB
// #define SQLITE_ENABLE_BYTECODE_VTAB
// #define SQLITE_ENABLE_DBPAGE_VTAB
// #define SQLITE_ENABLE_DBSTAT
// #define SQLITE_DEFAULT_MEMSTATUS 1
// #define SQLITE_ENABLE_OFFSET_SQL_FUNC


// === Optional - Removes features ===
#define SQLITE_OMIT_COMPILEOPTION_DIAGS
#define SQLITE_OMIT_BLOB_LITERAL
#define SQLITE_OMIT_PROGRESS_CALLBACK
#define SQLITE_MAX_EXPR_DEPTH 0
#define SQLITE_OMIT_DECLTYPE
#define SQLITE_OMIT_COMPILEOPTION_DIAGS
#define SQLITE_OMIT_DESERIALIZE
#define SQLITE_OMIT_GET_TABLE
#define SQLITE_OMIT_SCHEMA_VERSION_PRAGMAS
#define SQLITE_OMIT_AUTOINIT
