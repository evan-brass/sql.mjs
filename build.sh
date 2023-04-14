rm dist/*.wasm dist/*.wat dist/*.wasm.gz obj/*
mkdir obj

set -e

wasi-sdk-20.0/bin/clang \
	-c \
	-Os \
	-o obj/sqlite3.o \
	-D_HAVE_SQLITE_CONFIG_H \
	-Iinclude \
	vendor/sqlite3.c

wasi-sdk-20.0/bin/clang \
	-c \
	-Os \
	-o obj/vfs.o \
	-D_HAVE_SQLITE_CONFIG_H \
	-Iinclude \
	c_src/vfs.c

wasi-sdk-20.0/bin/wasm-ld \
	-o dist/sqlite3.wasm \
	-Llib \
	-lclang_rt.builtins-wasm32 \
	-lc \
	--no-entry \
	--export=allocate_vfs --export=set_logging \
	--export=malloc --export=free --export=realloc \
	--export=sqlite3_aggregate_context \
	--export=sqlite3_autovacuum_pages \
	--export=sqlite3_backup_finish \
	--export=sqlite3_backup_init \
	--export=sqlite3_backup_pagecount \
	--export=sqlite3_backup_remaining \
	--export=sqlite3_backup_step \
	--export=sqlite3_bind_blob \
	--export=sqlite3_bind_blob64 \
	--export=sqlite3_bind_double \
	--export=sqlite3_bind_int \
	--export=sqlite3_bind_int64 \
	--export=sqlite3_bind_null \
	--export=sqlite3_bind_parameter_count \
	--export=sqlite3_bind_parameter_index \
	--export=sqlite3_bind_parameter_name \
	--export=sqlite3_bind_pointer \
	--export=sqlite3_bind_text \
	--export=sqlite3_bind_text64 \
	--export=sqlite3_bind_value \
	--export=sqlite3_bind_zeroblob \
	--export=sqlite3_bind_zeroblob64 \
	--export=sqlite3_blob_bytes \
	--export=sqlite3_blob_close \
	--export=sqlite3_blob_open \
	--export=sqlite3_blob_read \
	--export=sqlite3_blob_reopen \
	--export=sqlite3_blob_write \
	--export=sqlite3_busy_handler \
	--export=sqlite3_busy_timeout \
	--export=sqlite3_changes \
	--export=sqlite3_changes64 \
	--export=sqlite3_clear_bindings \
	--export=sqlite3_close \
	--export=sqlite3_close_v2 \
	--export=sqlite3_collation_needed \
	--export=sqlite3_column_blob \
	--export=sqlite3_column_bytes \
	--export=sqlite3_column_count \
	--export=sqlite3_column_double \
	--export=sqlite3_column_int \
	--export=sqlite3_column_int64 \
	--export=sqlite3_column_name \
	--export=sqlite3_column_text \
	--export=sqlite3_column_type \
	--export=sqlite3_column_value \
	--export=sqlite3_commit_hook \
	--export=sqlite3_complete \
	--export=sqlite3_context_db_handle \
	--export=sqlite3_create_collation \
	--export=sqlite3_create_collation_v2 \
	--export=sqlite3_create_filename \
	--export=sqlite3_create_function \
	--export=sqlite3_create_function_v2 \
	--export=sqlite3_create_module \
	--export=sqlite3_create_module_v2 \
	--export=sqlite3_create_window_function \
	--export=sqlite3_data_count \
	--export=sqlite3_database_file_object \
	--export=sqlite3_db_cacheflush \
	--export=sqlite3_db_config \
	--export=sqlite3_db_filename \
	--export=sqlite3_db_handle \
	--export=sqlite3_db_mutex \
	--export=sqlite3_db_name \
	--export=sqlite3_db_readonly \
	--export=sqlite3_db_release_memory \
	--export=sqlite3_db_status \
	--export=sqlite3_declare_vtab \
	--export=sqlite3_drop_modules \
	--export=sqlite3_errcode \
	--export=sqlite3_errmsg \
	--export=sqlite3_error_offset \
	--export=sqlite3_errstr \
	--export=sqlite3_exec \
	--export=sqlite3_expanded_sql \
	--export=sqlite3_extended_errcode \
	--export=sqlite3_extended_result_codes \
	--export=sqlite3_file_control \
	--export=sqlite3_filename_database \
	--export=sqlite3_filename_journal \
	--export=sqlite3_filename_wal \
	--export=sqlite3_finalize \
	--export=sqlite3_free \
	--export=sqlite3_free_filename \
	--export=sqlite3_get_autocommit \
	--export=sqlite3_get_auxdata \
	--export=sqlite3_hard_heap_limit64 \
	--export=sqlite3_initialize \
	--export=sqlite3_interrupt \
	--export=sqlite3_is_interrupted \
	--export=sqlite3_last_insert_rowid \
	--export=sqlite3_limit \
	--export=sqlite3_log \
	--export=sqlite3_malloc \
	--export=sqlite3_malloc64 \
	--export=sqlite3_memory_highwater \
	--export=sqlite3_memory_used \
	--export=sqlite3_msize \
	--export=sqlite3_next_stmt \
	--export=sqlite3_open \
	--export=sqlite3_open_v2 \
	--export=sqlite3_overload_function \
	--export=sqlite3_prepare \
	--export=sqlite3_prepare_v2 \
	--export=sqlite3_prepare_v3 \
	--export=sqlite3_randomness \
	--export=sqlite3_realloc \
	--export=sqlite3_realloc64 \
	--export=sqlite3_release_memory \
	--export=sqlite3_reset \
	--export=sqlite3_reset_auto_extension \
	--export=sqlite3_result_blob \
	--export=sqlite3_result_blob64 \
	--export=sqlite3_result_double \
	--export=sqlite3_result_error \
	--export=sqlite3_result_error_code \
	--export=sqlite3_result_error_nomem \
	--export=sqlite3_result_error_toobig \
	--export=sqlite3_result_int \
	--export=sqlite3_result_int64 \
	--export=sqlite3_result_null \
	--export=sqlite3_result_pointer \
	--export=sqlite3_result_subtype \
	--export=sqlite3_result_text \
	--export=sqlite3_result_text64 \
	--export=sqlite3_result_value \
	--export=sqlite3_result_zeroblob \
	--export=sqlite3_result_zeroblob64 \
	--export=sqlite3_rollback_hook \
	--export=sqlite3_set_authorizer \
	--export=sqlite3_set_auxdata \
	--export=sqlite3_set_last_insert_rowid \
	--export=sqlite3_shutdown \
	--export=sqlite3_sleep \
	--export=sqlite3_soft_heap_limit64 \
	--export=sqlite3_sql \
	--export=sqlite3_status \
	--export=sqlite3_status64 \
	--export=sqlite3_step \
	--export=sqlite3_stmt_busy \
	--export=sqlite3_stmt_isexplain \
	--export=sqlite3_stmt_readonly \
	--export=sqlite3_stmt_status \
	--export=sqlite3_system_errno \
	--export=sqlite3_table_column_metadata \
	--export=sqlite3_total_changes \
	--export=sqlite3_total_changes64 \
	--export=sqlite3_txn_state \
	--export=sqlite3_update_hook \
	--export=sqlite3_uri_boolean \
	--export=sqlite3_uri_int64 \
	--export=sqlite3_uri_key \
	--export=sqlite3_uri_parameter \
	--export=sqlite3_user_data \
	--export=sqlite3_value_blob \
	--export=sqlite3_value_bytes \
	--export=sqlite3_value_double \
	--export=sqlite3_value_dup \
	--export=sqlite3_value_encoding \
	--export=sqlite3_value_free \
	--export=sqlite3_value_frombind \
	--export=sqlite3_value_int \
	--export=sqlite3_value_int64 \
	--export=sqlite3_value_nochange \
	--export=sqlite3_value_numeric_type \
	--export=sqlite3_value_pointer \
	--export=sqlite3_value_subtype \
	--export=sqlite3_value_text \
	--export=sqlite3_value_type \
	--export=sqlite3_vfs_find \
	--export=sqlite3_vfs_register \
	--export=sqlite3_vfs_unregister \
	--export=sqlite3_vtab_collation \
	--export=sqlite3_vtab_config \
	--export=sqlite3_vtab_distinct \
	--export=sqlite3_vtab_in \
	--export=sqlite3_vtab_in_first \
	--export=sqlite3_vtab_in_next \
	--export=sqlite3_vtab_nochange \
	--export=sqlite3_vtab_on_conflict \
	--export=sqlite3_vtab_rhs_value \
	obj/*.o

wasm2wat dist/sqlite3.wasm > dist/sqlite3.wat
grep -E "\(import|\(export" dist/sqlite3.wat

# wasm-opt \
# 	-O4 \
# 	-o dist/sqlite3_opt.wasm \
# 	dist/sqlite3.wasm

# gzip -k dist/sqlite3_opt.wasm
gzip -k dist/sqlite3.wasm

# wasm-opt \
# 	-O4 \
# 	--asyncify \
# 	-o dist/sqlite3_opt_async.wasm \
# 	dist/sqlite3_opt.wasm

# gzip -k dist/sqlite3_opt_async.wasm
