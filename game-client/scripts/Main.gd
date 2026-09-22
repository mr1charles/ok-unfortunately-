extends Node3D
## Vertical-slice orchestrator: login, spawn the player on City Island,
## stream chunks around them, and wire up the buy/mine/build/shield/attack
## loops. Every gameplay action here calls the server through Api and only
## updates the world once the server confirms it - see GameState.gd and
## ApiClient.gd for the client/server contract this whole game is built on.

const DEFAULT_WORLD_KEY := "city-island"
const MINING_HOLD_SECONDS := 1.5
const MINING_RANGE := 3.0
const ConnectionEffect = preload("res://scripts/world/ConnectionEffect.gd")
const ShieldDome = preload("res://scripts/world/ShieldDome.gd")

var hud
var player: CharacterBody3D
var chunk_manager: Node3D
var pixel_selector: Node3D
var login_layer: CanvasLayer

var my_properties: Array = []
var mining_target: Dictionary = {} # {propertyId, position: Vector3}
var mining_hold_time: float = 0.0
var is_mining: bool = false
var build_mode_object_type: String = ""
var build_preview: MeshInstance3D
var _entered_world: bool = false
var decoration_catalog: Array = []
var defense_catalog: Array = []


func _ready() -> void:
	_setup_environment()
	var oauth_test := OS.get_environment("PIXEL_ESTATES_TEST_OAUTH")
	var autologin := OS.get_environment("PIXEL_ESTATES_AUTOLOGIN")
	if oauth_test != "":
		# Headless/CI convenience: PIXEL_ESTATES_TEST_OAUTH="provider:email:name"
		# exercises the same mock-token build + POST /auth/oauth/:provider path
		# the dev sign-in dialog uses, without needing UI interaction.
		var parts := oauth_test.split(":", true, 2)
		var provider: String = parts[0]
		var email: String = parts[1] if parts.size() > 1 else "test@example.com"
		var name: String = parts[2] if parts.size() > 2 else "Test User"
		print("[Main] PIXEL_ESTATES_TEST_OAUTH set, testing ", provider, " sign-in for ", email)
		var sub := "dev-%s-%s" % [provider, email.to_lower()]
		var id_token := GameState.build_mock_id_token(sub, email, name)
		var result := await Api.oauth_sign_in(provider, id_token)
		print("[TEST] oauth ok=", result.get("ok"), " status=", result.get("status"), " err=", result.get("error"))
		if result.get("ok", false):
			var data: Dictionary = result.get("data", {})
			print("[TEST] isNewAccount=", data.get("isNewAccount"), " username=", data.get("user", {}).get("username"))
			await _complete_session(data)
	elif autologin != "":
		# Headless/CI convenience: PIXEL_ESTATES_AUTOLOGIN="email:password"
		# skips the login screen. Never used unless that env var is set.
		var parts := autologin.split(":", true, 1)
		print("[Main] PIXEL_ESTATES_AUTOLOGIN set, skipping login screen for ", parts[0])
		var dummy_status := Label.new()
		var dummy_button := Button.new()
		add_child(dummy_status)
		add_child(dummy_button)
		await _attempt_login(parts[0], parts[1] if parts.size() > 1 else "", dummy_status, dummy_button)
		dummy_status.queue_free()
		dummy_button.queue_free()
	else:
		_show_login_screen()


# --- Environment -----------------------------------------------------------

func _setup_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.30, 0.55, 0.95)
	sky_mat.sky_horizon_color = Color(0.75, 0.85, 0.95)
	sky_mat.ground_bottom_color = Color(0.4, 0.4, 0.42)
	sky_mat.ground_horizon_color = Color(0.75, 0.85, 0.95)
	sky.sky_material = sky_mat
	env.sky = sky
	env.fog_enabled = true
	env.fog_light_color = Color(0.75, 0.83, 0.92)
	env.fog_density = 0.006
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY

	var world_env := WorldEnvironment.new()
	world_env.environment = env
	add_child(world_env)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, -35, 0)
	sun.light_energy = 1.1
	sun.shadow_enabled = true
	add_child(sun)


# --- Login -------------------------------------------------------------

func _show_login_screen() -> void:
	login_layer = CanvasLayer.new()
	add_child(login_layer)

	var dim := ColorRect.new()
	dim.color = Color(0.05, 0.08, 0.12, 1.0)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	login_layer.add_child(dim)

	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.custom_minimum_size = Vector2(360, 10)
	dim.add_child(panel)
	panel.position -= panel.custom_minimum_size / 2.0

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 10)
	panel.add_child(vbox)

	var title := Label.new()
	title.text = "🏙️ Pixel Estates"
	title.add_theme_font_size_override("font_size", 28)
	vbox.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "Log in with an account created on the web app\n(or use a seeded test account below)."
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD
	vbox.add_child(subtitle)

	var email_field := LineEdit.new()
	email_field.placeholder_text = "email or username"
	email_field.text = "alice@example.com"
	vbox.add_child(email_field)

	var password_field := LineEdit.new()
	password_field.placeholder_text = "password"
	password_field.text = "password123"
	password_field.secret = true
	vbox.add_child(password_field)

	var status_label := Label.new()
	status_label.modulate = Color(1, 0.6, 0.6)
	vbox.add_child(status_label)

	var login_button := Button.new()
	login_button.text = "Enter the World"
	vbox.add_child(login_button)

	var demo_row := HBoxContainer.new()
	vbox.add_child(demo_row)
	for demo_user in ["alice", "bob", "carol", "admin"]:
		var demo_button := Button.new()
		demo_button.text = demo_user
		demo_button.pressed.connect(func():
			if demo_user == "admin":
				email_field.text = "admin@pixelestates.dev"
				password_field.text = "admin123"
			else:
				email_field.text = "%s@example.com" % demo_user
				password_field.text = "password123"
		)
		demo_row.add_child(demo_button)

	login_button.pressed.connect(func():
		_attempt_login(email_field.text, password_field.text, status_label, login_button)
	)

	var social_label := Label.new()
	social_label.text = "or continue with"
	social_label.add_theme_font_size_override("font_size", 11)
	social_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(social_label)

	var social_row := HBoxContainer.new()
	social_row.alignment = BoxContainer.ALIGNMENT_CENTER
	social_row.add_theme_constant_override("separation", 8)
	vbox.add_child(social_row)
	for social in [["google", "Google"], ["apple", "Apple"], ["microsoft", "Microsoft"]]:
		var social_button := Button.new()
		social_button.text = "%s (dev)" % social[1]
		social_button.pressed.connect(func(): _show_oauth_dev_dialog(dim, social[0], social[1], status_label))
		social_row.add_child(social_button)


func _attempt_login(email: String, password: String, status_label: Label, login_button: Button) -> void:
	login_button.disabled = true
	status_label.text = "Connecting..."
	var result := await Api.login(email, password)
	if not result.get("ok", false):
		status_label.text = result.get("error", "Login failed")
		login_button.disabled = false
		return
	await _complete_session(result.get("data", {}))


## Shared by password login and social sign-in: stores the session, warms
## the credits cache, and transitions from the login screen into the world.
func _complete_session(data: Dictionary) -> void:
	GameState.set_session(String(data.get("token", "")), data.get("user", {}))

	var credits_result := await Api.get_credits()
	if credits_result.get("ok", false):
		GameState.set_credits(int(credits_result.get("data", {}).get("credits", 0)))

	if login_layer:
		login_layer.queue_free()
	await _enter_world()


## Dev-mode "Sign in with <provider>" dialog - the Godot-side equivalent of
## client/src/components/auth/SocialSignInButtons.tsx's dev dialog. Real
## native Google/Apple/Microsoft SDK plugins for Godot's iOS/Android export
## are a follow-up (they require platform-specific plugin binaries built
## with Xcode/Android Studio, which this environment can't produce); this
## calls the exact same POST /api/auth/oauth/:provider endpoint a real
## native SDK integration would, so swapping in real plugins later only
## means replacing where `id_token` comes from.
func _show_oauth_dev_dialog(parent: Control, provider_key: String, provider_label: String, outer_status: Label) -> void:
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.5)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	parent.add_child(dim)

	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.custom_minimum_size = Vector2(320, 10)
	dim.add_child(panel)
	panel.position -= panel.custom_minimum_size / 2.0

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 8)
	panel.add_child(vbox)

	var title := Label.new()
	title.text = "Dev sign-in: %s" % provider_label
	title.add_theme_font_size_override("font_size", 18)
	vbox.add_child(title)

	var hint := Label.new()
	hint.text = "No real %s app is configured, so this simulates the name/email a real sign-in would return." % provider_label
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD
	vbox.add_child(hint)

	var name_field := LineEdit.new()
	name_field.placeholder_text = "name"
	vbox.add_child(name_field)

	var email_field := LineEdit.new()
	email_field.placeholder_text = "email"
	vbox.add_child(email_field)

	var dialog_status := Label.new()
	dialog_status.modulate = Color(1, 0.6, 0.6)
	vbox.add_child(dialog_status)

	var button_row := HBoxContainer.new()
	vbox.add_child(button_row)

	var cancel_button := Button.new()
	cancel_button.text = "Cancel"
	cancel_button.pressed.connect(func(): dim.queue_free())
	button_row.add_child(cancel_button)

	var continue_button := Button.new()
	continue_button.text = "Continue"
	continue_button.pressed.connect(func():
		if email_field.text.strip_edges() == "":
			dialog_status.text = "Enter an email"
			return
		continue_button.disabled = true
		var display_name: String = name_field.text.strip_edges() if name_field.text.strip_edges() != "" else email_field.text.split("@")[0]
		var sub := "dev-%s-%s" % [provider_key, email_field.text.strip_edges().to_lower()]
		var id_token := GameState.build_mock_id_token(sub, email_field.text.strip_edges().to_lower(), display_name)
		var result := await Api.oauth_sign_in(provider_key, id_token)
		if not result.get("ok", false):
			dialog_status.text = result.get("error", "Sign-in failed")
			continue_button.disabled = false
			return
		dim.queue_free()
		await _complete_session(result.get("data", {}))
	)
	button_row.add_child(continue_button)


# --- World entry -------------------------------------------------------

func _enter_world() -> void:
	if _entered_world:
		return
	_entered_world = true

	hud = load("res://scripts/ui/HUD.gd").new()
	add_child(hud)

	var world_result := await Api.get_world(DEFAULT_WORLD_KEY)
	if not world_result.get("ok", false):
		hud.toast("Could not load %s: %s" % [DEFAULT_WORLD_KEY, world_result.get("error", "")], "error")
		return
	var world: Dictionary = world_result.get("data", {}).get("world", {})
	GameState.set_world(world)

	var catalog_result := await Api.get_decoration_catalog()
	if catalog_result.get("ok", false):
		decoration_catalog = catalog_result.get("data", {}).get("catalog", [])
	var defense_result := await Api.get_defense_catalog()
	if defense_result.get("ok", false):
		defense_catalog = defense_result.get("data", {}).get("catalog", [])

	_spawn_player(world)
	_spawn_chunk_manager(world)
	_spawn_pixel_selector()

	await _refresh_my_properties()

	if OS.get_environment("PIXEL_ESTATES_TEST_ACTIONS") != "":
		await _run_test_actions()


## Headless/CI convenience (like PIXEL_ESTATES_AUTOLOGIN): exercises the
## gameplay action methods directly, bypassing the camera-raycast pixel
## targeting that only makes sense with a real cursor. Never runs unless
## PIXEL_ESTATES_TEST_ACTIONS is explicitly set.
func _run_test_actions() -> void:
	print("[TEST] buying a fresh 3x3 patch...")
	var wid = GameState.current_world.get("id")
	var buy_result := await Api.purchase_points(wid, [
		{"x": 5030, "y": 5030}, {"x": 5031, "y": 5030}, {"x": 5032, "y": 5030},
		{"x": 5030, "y": 5031}, {"x": 5031, "y": 5031}, {"x": 5032, "y": 5031},
	], "#ff8800")
	print("[TEST] buy ok=", buy_result.get("ok"), " data=", buy_result.get("data"), " err=", buy_result.get("error"))
	await _refresh_my_properties()

	print("[TEST] mining...")
	if not mining_target.is_empty():
		await _do_mine()

	print("[TEST] attacking...")
	await _do_attack()

	if my_properties.size() > 0:
		var pid = my_properties[0].get("id")
		var px = int(my_properties[0].get("minX", 0))
		var py = int(my_properties[0].get("minY", 0))
		print("[TEST] placing a decoration at (", px, ",", py, ") on property ", pid)
		var deco_result := await Api.place_decoration(pid, "tree", px, py, 0)
		print("[TEST] place ok=", deco_result.get("ok"), " err=", deco_result.get("error"))

		print("[TEST] purchasing a shield...")
		await _purchase_shield("SHIELD")

	print("[TEST] all actions completed without crashing.")


func _spawn_player(world: Dictionary) -> void:
	player = CharacterBody3D.new()
	player.set_script(load("res://scripts/player/Player.gd"))
	add_child(player)

	var spawn_x := float(GameState.player_pixel_x)
	var spawn_y := float(GameState.player_pixel_y)
	if my_properties.size() > 0:
		pass # will be repositioned after property load if desired; center default is fine for vertical slice
	player.global_position = Vector3(spawn_x, 1.0, spawn_y)


func _spawn_chunk_manager(world: Dictionary) -> void:
	chunk_manager = Node3D.new()
	chunk_manager.set_script(load("res://scripts/world/ChunkManager.gd"))
	add_child(chunk_manager)
	chunk_manager.player = player
	chunk_manager.set_world(world)


func _spawn_pixel_selector() -> void:
	pixel_selector = Node3D.new()
	pixel_selector.set_script(load("res://scripts/world/PixelSelector.gd"))
	add_child(pixel_selector)
	pixel_selector.player = player
	pixel_selector.selection_finalized.connect(_on_selection_finalized)


# --- Buying pixels -------------------------------------------------------

func _on_selection_finalized(x1: int, y1: int, x2: int, y2: int) -> void:
	var count := (x2 - x1 + 1) * (y2 - y1 + 1)
	var price := count * int(GameState.current_world.get("pixelPriceCents", 1))
	hud.show_buy_confirm(count, price, func(): _confirm_purchase(x1, y1, x2, y2))


func _confirm_purchase(x1: int, y1: int, x2: int, y2: int) -> void:
	var color := "#4f7cff"
	if not GameState.character_appearance.is_empty():
		color = String(GameState.character_appearance.get("outfitColor", color))
	var result := await Api.purchase_rect(GameState.current_world.get("id"), x1, y1, x2, y2, color)
	pixel_selector.clear()

	if not result.get("ok", false):
		hud.toast(result.get("error", "Purchase failed"), "error")
		return

	var data: Dictionary = result.get("data", {})
	hud.toast("Bought %d pixels for %s!" % [int(data.get("purchasedCount", 0)), GameState.format_cents(int(data.get("totalCents", 0)))], "success")

	var me_result := await Api.fetch_me()
	if me_result.get("ok", false):
		GameState.set_balance(int(me_result.get("data", {}).get("user", {}).get("balanceCents", GameState.balance_cents)))

	chunk_manager.force_refresh()

	if bool(data.get("newlyConnected", false)):
		var center := Vector3((x1 + x2) / 2.0 + 0.5, 0, (y1 + y2) / 2.0 + 0.5)
		ConnectionEffect.spawn(self, center, Color(color))

	await _refresh_my_properties()


func _refresh_my_properties() -> void:
	var result := await Api.list_my_properties(GameState.current_world.get("id"))
	if not result.get("ok", false):
		return
	my_properties = result.get("data", {}).get("properties", [])

	var total_pixels := 0
	for p in my_properties:
		total_pixels += int(p.get("pixelCount", 0))
	hud.set_land_count(total_pixels, my_properties.size())

	_refresh_shield_domes()
	_refresh_mining_target()


func _refresh_shield_domes() -> void:
	for child in get_children():
		if child.has_meta("is_shield_dome"):
			child.queue_free()
	for p in my_properties:
		var defenses: Array = p.get("defenses", [])
		if defenses.is_empty():
			continue
		var min_x := float(p.get("minX", 0))
		var min_y := float(p.get("minY", 0))
		var max_x := float(p.get("maxX", 0))
		var max_y := float(p.get("maxY", 0))
		var center := Vector3((min_x + max_x) / 2.0 + 0.5, 0, (min_y + max_y) / 2.0 + 0.5)
		var span: float = max(max_x - min_x, max_y - min_y) + 2.0
		var dome := ShieldDome.spawn(self, center, span / 1.6)
		dome.set_meta("is_shield_dome", true)


func _refresh_mining_target() -> void:
	if my_properties.is_empty():
		mining_target = {}
		return
	var p: Dictionary = my_properties[0]
	var min_x := float(p.get("minX", 0))
	var min_y := float(p.get("minY", 0))
	var max_x := float(p.get("maxX", 0))
	var max_y := float(p.get("maxY", 0))
	var center := Vector3((min_x + max_x) / 2.0 + 0.5, 0, (min_y + max_y) / 2.0 + 0.5)
	mining_target = {"propertyId": p.get("id"), "position": center}
	_ensure_mining_node()


var mining_node_visual: MeshInstance3D


func _ensure_mining_node() -> void:
	if mining_node_visual and is_instance_valid(mining_node_visual):
		mining_node_visual.queue_free()
	if mining_target.is_empty():
		return
	mining_node_visual = MeshInstance3D.new()
	var prism := PrismMesh.new()
	prism.size = Vector3(0.4, 0.6, 0.4)
	mining_node_visual.mesh = prism
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.6, 0.95, 1.0)
	mat.emission_enabled = true
	mat.emission = Color(0.4, 0.9, 1.0)
	mat.emission_energy_multiplier = 1.5
	mining_node_visual.material_override = mat
	mining_node_visual.position = (mining_target["position"] as Vector3) + Vector3(0, 0.5, 0)
	add_child(mining_node_visual)


# --- Frame loop: mining hold-to-interact, target info, hotkeys -----------

func _process(delta: float) -> void:
	if player == null or hud == null:
		return
	_update_target_info()
	_process_mining(delta)
	_process_build_placement()


func _update_target_info() -> void:
	if player.target_pixel == null:
		hud.set_target_info("")
		return
	var px: Vector2i = player.target_pixel
	if build_mode_object_type != "":
		hud.set_target_info("Placing: %s at (%d, %d) - [E] to place, [Esc] cancel" % [build_mode_object_type, px.x, px.y])
	else:
		hud.set_target_info("Pixel (%d, %d) - $%.2f/pixel  [hold LMB to select]" % [px.x, px.y, float(GameState.current_world.get("pixelPriceCents", 1)) / 100.0])


func _process_mining(delta: float) -> void:
	if mining_target.is_empty():
		return
	var pos: Vector3 = mining_target["position"]
	var dist := player.global_position.distance_to(pos)
	if dist <= MINING_RANGE and Input.is_action_pressed("interact") and build_mode_object_type == "":
		is_mining = true
		mining_hold_time += delta
		hud.show_mining_progress(clamp(mining_hold_time / MINING_HOLD_SECONDS, 0.0, 1.0))
		if mining_hold_time >= MINING_HOLD_SECONDS:
			mining_hold_time = 0.0
			is_mining = false
			_do_mine()
	elif is_mining:
		is_mining = false
		mining_hold_time = 0.0


func _do_mine() -> void:
	var result := await Api.mine_property(mining_target.get("propertyId"))
	if not result.get("ok", false):
		hud.toast(result.get("error", "Nothing to mine right now"), "warning")
		return
	var data: Dictionary = result.get("data", {})
	GameState.set_credits(int(data.get("credits", GameState.credits)))
	hud.toast("+%d credits from mining!" % int(data.get("reward", 0)), "success")


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("open_build_menu"):
		_open_build_menu()
	elif event.is_action_pressed("shield_menu"):
		_open_shield_menu()
	elif event.is_action_pressed("attack_action"):
		_do_attack()
	elif event.is_action_pressed("cancel_selection") and build_mode_object_type != "":
		_cancel_build_mode()
	elif event.is_action_pressed("interact") and build_mode_object_type != "":
		_place_building()


func _open_build_menu() -> void:
	if hud == null or decoration_catalog.is_empty():
		return
	var options: Array = []
	for entry in decoration_catalog:
		options.append({"label": "%s %s" % [String(entry.get("emoji", "")), String(entry.get("label", ""))], "value": entry.get("key")})
	hud.show_choice_menu("Build", options, func(object_type):
		build_mode_object_type = String(object_type)
		hud.toast("Placement mode: %s - look at your land and press E" % build_mode_object_type)
	)


func _process_build_placement() -> void:
	if build_mode_object_type == "":
		if build_preview:
			build_preview.visible = false
		return
	if player.target_pixel == null:
		if build_preview:
			build_preview.visible = false
		return
	if build_preview == null:
		build_preview = MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = Vector3(0.9, 0.6, 0.9)
		build_preview.mesh = box
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.4, 1.0, 0.5, 0.55)
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		build_preview.material_override = mat
		add_child(build_preview)
	build_preview.visible = true
	var px: Vector2i = player.target_pixel
	build_preview.position = Vector3(px.x + 0.5, 0.3, px.y + 0.5)


func _cancel_build_mode() -> void:
	build_mode_object_type = ""
	if build_preview:
		build_preview.visible = false


func _place_building() -> void:
	if player.target_pixel == null or my_properties.is_empty():
		return
	var px: Vector2i = player.target_pixel
	var target_property = _find_property_containing(px)
	if target_property == null:
		hud.toast("You can only build on your own land", "error")
		return
	var result := await Api.place_decoration(target_property.get("id"), build_mode_object_type, px.x, px.y, 0)
	if not result.get("ok", false):
		hud.toast(result.get("error", "Could not place that here"), "error")
		return
	hud.toast("Placed %s!" % build_mode_object_type, "success")
	_cancel_build_mode()


func _find_property_containing(px: Vector2i) -> Variant:
	for p in my_properties:
		if px.x >= int(p.get("minX", 0)) and px.x <= int(p.get("maxX", 0)) and px.y >= int(p.get("minY", 0)) and px.y <= int(p.get("maxY", 0)):
			return p
	return null


func _open_shield_menu() -> void:
	if my_properties.is_empty():
		hud.toast("You need a property before you can defend it", "warning")
		return
	var options: Array = []
	for entry in defense_catalog:
		options.append({
			"label": "%s %s - %d credits" % [String(entry.get("emoji", "")), String(entry.get("label", "")), int(entry.get("creditCost", 0))],
			"value": entry.get("kind"),
		})
	hud.show_choice_menu("Defenses", options, func(kind):
		_purchase_shield(String(kind))
	)


func _purchase_shield(kind: String) -> void:
	var property_id = my_properties[0].get("id")
	var result := await Api.purchase_defense(property_id, kind)
	if not result.get("ok", false):
		hud.toast(result.get("error", "Could not purchase defense"), "error")
		return
	hud.toast("%s activated!" % kind, "success")
	var credits_result := await Api.get_credits()
	if credits_result.get("ok", false):
		GameState.set_credits(int(credits_result.get("data", {}).get("credits", 0)))
	await _refresh_my_properties()


func _do_attack() -> void:
	var result := await Api.execute_attack(GameState.current_world.get("id"))
	if not result.get("ok", false):
		hud.toast(result.get("error", "Could not attack right now"), "warning")
		return
	var data: Dictionary = result.get("data", {})
	hud.show_attack_result(String(data.get("result", "FAILED")), String(data.get("message", "")))
	var credits_result := await Api.get_credits()
	if credits_result.get("ok", false):
		GameState.set_credits(int(credits_result.get("data", {}).get("credits", 0)))
