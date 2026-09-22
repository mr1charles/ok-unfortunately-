extends Node
## Central session/game state. The 3D client NEVER trusts itself for money or
## ownership - every field here is just a local cache of what the server last
## told us, refreshed after every server call. The server is authoritative;
## see ApiClient.gd for the HTTP layer and README in this folder for the
## client/server contract.

signal balance_changed(balance_cents: int)
signal credits_changed(credits: int)
signal pixels_purchased(result: Dictionary)
signal notification(text: String, kind: String)
signal world_changed(world: Dictionary)

const DEFAULT_BASE_URL := "http://127.0.0.1:4000/api"

var base_url: String = DEFAULT_BASE_URL
var auth_token: String = ""
var is_test_environment: bool = false

var user_id: String = ""
var username: String = ""
var balance_cents: int = 0
var credits: int = 0
var character_appearance: Dictionary = {}

var current_world: Dictionary = {}
var player_pixel_x: int = 5000
var player_pixel_y: int = 5000


func is_authed() -> bool:
	return auth_token != ""


func set_session(token: String, user: Dictionary) -> void:
	auth_token = token
	user_id = user.get("id", "")
	username = user.get("username", "")
	set_balance(int(user.get("balanceCents", 0)))
	if user.has("character"):
		character_appearance = user.get("character", {}).get("appearance", {})


func set_balance(cents: int) -> void:
	balance_cents = cents
	balance_changed.emit(balance_cents)


func set_credits(amount: int) -> void:
	credits = amount
	credits_changed.emit(credits)


func set_world(world: Dictionary) -> void:
	current_world = world
	is_test_environment = bool(world.get("isTestCopy", false))
	world_changed.emit(world)


func format_cents(cents: int) -> String:
	var sign: String = "-" if cents < 0 else ""
	var abs_cents: int = absi(cents)
	return "%s$%d.%02d" % [sign, abs_cents / 100, abs_cents % 100]


## Builds a dev-mode "mock" identity token in the exact format
## server/src/lib/oauth/mockProvider.ts expects (`mock.<base64url JSON>`) -
## the GDScript equivalent of client/src/lib/mockOAuth.ts. Only ever used
## for a provider GET /auth/oauth/providers reports as not "live".
func build_mock_id_token(sub: String, email: String, name: String) -> String:
	var json := JSON.stringify({"sub": sub, "email": email, "name": name})
	var b64 := Marshalls.utf8_to_base64(json)
	b64 = b64.replace("+", "-").replace("/", "_").rstrip("=")
	return "mock.%s" % b64
