extends Node
## Thin HTTP client for the Pixel Estates backend (the same Express/Prisma
## server the React web app talks to). Every gameplay action the 3D client
## can take goes through here as a request; the server validates and
## responds, and the client only ever renders what comes back. The client
## never decides "I own this" or "I can afford this" on its own.

const METHOD_GET := HTTPClient.METHOD_GET
const METHOD_POST := HTTPClient.METHOD_POST
const METHOD_PATCH := HTTPClient.METHOD_PATCH
const METHOD_DELETE := HTTPClient.METHOD_DELETE


func _auth_headers(with_json: bool = true) -> PackedStringArray:
	var headers: Array[String] = []
	if with_json:
		headers.append("Content-Type: application/json")
	if GameState.auth_token != "":
		headers.append("Authorization: Bearer %s" % GameState.auth_token)
	return PackedStringArray(headers)


func _request(path: String, method: int, body: Dictionary = {}) -> Dictionary:
	var http := HTTPRequest.new()
	add_child(http)

	var body_str := ""
	var has_body := method == METHOD_POST or method == METHOD_PATCH
	if has_body:
		body_str = JSON.stringify(body)

	var err := http.request(GameState.base_url + path, _auth_headers(has_body), method, body_str)
	if err != OK:
		http.queue_free()
		return {"ok": false, "status": 0, "data": {}, "error": "request_failed"}

	var response = await http.request_completed
	http.queue_free()

	var result: int = response[0]
	var status_code: int = response[1]
	var raw_body: PackedByteArray = response[3]

	if result != HTTPRequest.RESULT_SUCCESS:
		return {"ok": false, "status": status_code, "data": {}, "error": "network_error"}

	var text := raw_body.get_string_from_utf8()
	var parsed = JSON.parse_string(text) if text.length() > 0 else {}
	if parsed == null:
		parsed = {}

	var ok := status_code >= 200 and status_code < 300
	var error_message := ""
	if not ok and typeof(parsed) == TYPE_DICTIONARY:
		error_message = str(parsed.get("message", "Request failed (%d)" % status_code))

	return {"ok": ok, "status": status_code, "data": parsed, "error": error_message}


func get_json(path: String) -> Dictionary:
	return await _request(path, METHOD_GET)


func post_json(path: String, body: Dictionary = {}) -> Dictionary:
	return await _request(path, METHOD_POST, body)


func patch_json(path: String, body: Dictionary = {}) -> Dictionary:
	return await _request(path, METHOD_PATCH, body)


func delete_json(path: String) -> Dictionary:
	return await _request(path, METHOD_DELETE)


# --- Auth -----------------------------------------------------------------

func login(email_or_username: String, password: String) -> Dictionary:
	return await post_json("/auth/login", {"emailOrUsername": email_or_username, "password": password})


func fetch_me() -> Dictionary:
	return await get_json("/auth/me")


func fetch_oauth_providers() -> Dictionary:
	return await get_json("/auth/oauth/providers")


## `provider` is "google" | "apple" | "microsoft" (lowercase). `id_token` is
## either a real signed ID token from that provider's native SDK, or a
## `mock.<base64url json>` token built by build_mock_id_token() below when
## running against a provider the server reports as not "live" - see
## the dev sign-in dialog wired up in Main.gd.
func oauth_sign_in(provider: String, id_token: String) -> Dictionary:
	return await post_json("/auth/oauth/%s" % provider, {"idToken": id_token})


# --- Worlds -----------------------------------------------------------------

func list_worlds() -> Dictionary:
	return await get_json("/worlds")


func get_world(key: String) -> Dictionary:
	return await get_json("/worlds/%s" % key)


func get_chunk(world_id: String, chunk_x: int, chunk_y: int, radius: int) -> Dictionary:
	return await get_json("/worlds/%s/chunks?cx=%d&cy=%d&radius=%d" % [world_id, chunk_x, chunk_y, radius])


func get_pixel_info(world_id: String, x: int, y: int) -> Dictionary:
	return await get_json("/worlds/%s/pixels/%d/%d" % [world_id, x, y])


func purchase_rect(world_id: String, x1: int, y1: int, x2: int, y2: int, color_hex: String) -> Dictionary:
	return await post_json("/worlds/%s/pixels/purchase" % world_id, {
		"mode": "rect", "x1": x1, "y1": y1, "x2": x2, "y2": y2, "colorHex": color_hex,
	})


func purchase_points(world_id: String, coords: Array, color_hex: String) -> Dictionary:
	return await post_json("/worlds/%s/pixels/purchase" % world_id, {
		"mode": "points", "coords": coords, "colorHex": color_hex,
	})


func list_my_properties(world_id: String) -> Dictionary:
	return await get_json("/worlds/%s/properties/mine" % world_id)


func get_property(property_id: String) -> Dictionary:
	return await get_json("/properties/%s" % property_id)


func set_property_color(property_id: String, color_hex: String) -> Dictionary:
	return await patch_json("/properties/%s/color" % property_id, {"colorHex": color_hex})


# --- Decorations / building --------------------------------------------

func get_decoration_catalog() -> Dictionary:
	return await get_json("/decorations/catalog")


func list_property_decorations(property_id: String) -> Dictionary:
	return await get_json("/properties/%s/decorations" % property_id)


func place_decoration(property_id: String, object_type: String, x: int, y: int, rotation: int) -> Dictionary:
	return await post_json("/properties/%s/decorations" % property_id, {
		"objectType": object_type, "x": x, "y": y, "rotation": rotation,
	})


# --- Credits / mining -------------------------------------------------

func get_credits() -> Dictionary:
	return await get_json("/credits")


func mine_property(property_id: String) -> Dictionary:
	return await post_json("/credits/mine", {"propertyId": property_id})


# --- Defenses -----------------------------------------------------------

func get_defense_catalog() -> Dictionary:
	return await get_json("/defenses/catalog")


func list_property_defenses(property_id: String) -> Dictionary:
	return await get_json("/defenses/property/%s" % property_id)


func purchase_defense(property_id: String, kind: String) -> Dictionary:
	return await post_json("/defenses/property/%s" % property_id, {"kind": kind})


# --- Attacks --------------------------------------------------------------

func get_attack_allowance() -> Dictionary:
	return await get_json("/attacks/allowance")


func execute_attack(world_id: String) -> Dictionary:
	return await post_json("/attacks/execute", {"worldId": world_id})


func get_attack_history() -> Dictionary:
	return await get_json("/attacks/history")
