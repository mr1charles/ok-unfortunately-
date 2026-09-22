extends CanvasLayer
## In-game HUD: stat sidebar (avatar/username/money/credits/land),
## crosshair, a toast/notification stack, and the handful of action panels
## (buy confirm, attack result, build menu, shield menu). Everything is
## built in code so the whole UI lives in one reviewable file. Collapses
## with Tab (toggle_hud) so the world stays the focus while exploring.

var sidebar: PanelContainer
var sidebar_visible: bool = true
var balance_label: Label
var credits_label: Label
var land_label: Label
var world_label: Label
var test_banner: Label
var crosshair: Control
var toast_stack: VBoxContainer
var target_info: Label

var modal_layer: Control


func _ready() -> void:
	layer = 10
	_build_crosshair()
	_build_sidebar()
	_build_toast_stack()
	_build_target_info()
	modal_layer = Control.new()
	modal_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	modal_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(modal_layer)

	GameState.balance_changed.connect(_on_balance_changed)
	GameState.credits_changed.connect(_on_credits_changed)
	GameState.world_changed.connect(_on_world_changed)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("toggle_hud"):
		sidebar_visible = not sidebar_visible
		sidebar.visible = sidebar_visible


func _build_crosshair() -> void:
	crosshair = Control.new()
	crosshair.set_anchors_preset(Control.PRESET_CENTER)
	crosshair.custom_minimum_size = Vector2(8, 8)
	crosshair.position -= Vector2(4, 4)
	crosshair.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(crosshair)

	var dot := ColorRect.new()
	dot.color = Color(1, 1, 1, 0.85)
	dot.size = Vector2(4, 4)
	dot.position = Vector2(2, 2)
	crosshair.add_child(dot)


func _build_target_info() -> void:
	target_info = Label.new()
	target_info.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	target_info.position = Vector2(-160, -90)
	target_info.custom_minimum_size = Vector2(320, 40)
	target_info.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	target_info.add_theme_color_override("font_color", Color.WHITE)
	target_info.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	target_info.add_theme_constant_override("shadow_offset_x", 1)
	target_info.add_theme_constant_override("shadow_offset_y", 1)
	add_child(target_info)


func set_target_info(text: String) -> void:
	target_info.text = text


func _build_sidebar() -> void:
	sidebar = PanelContainer.new()
	sidebar.set_anchors_preset(Control.PRESET_TOP_LEFT)
	sidebar.position = Vector2(12, 12)
	sidebar.custom_minimum_size = Vector2(230, 10)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.06, 0.08, 0.14, 0.78)
	style.corner_radius_top_left = 14
	style.corner_radius_top_right = 14
	style.corner_radius_bottom_left = 14
	style.corner_radius_bottom_right = 14
	style.content_margin_left = 14
	style.content_margin_right = 14
	style.content_margin_top = 12
	style.content_margin_bottom = 12
	sidebar.add_theme_stylebox_override("panel", style)
	add_child(sidebar)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 4)
	sidebar.add_child(vbox)

	world_label = _make_label(vbox, "Pixel Estates", 18, Color.WHITE)
	test_banner = _make_label(vbox, "", 13, Color(1.0, 0.55, 0.2))
	test_banner.visible = false

	var user_row := Label.new()
	user_row.text = "@%s" % GameState.username
	user_row.add_theme_font_size_override("font_size", 14)
	user_row.add_theme_color_override("font_color", Color(0.75, 0.8, 1.0))
	vbox.add_child(user_row)

	vbox.add_child(HSeparator.new())

	balance_label = _make_label(vbox, "Balance: %s" % GameState.format_cents(GameState.balance_cents), 15, Color(0.55, 1.0, 0.65))
	credits_label = _make_label(vbox, "Credits: %d" % GameState.credits, 15, Color(1.0, 0.85, 0.3))
	land_label = _make_label(vbox, "Land: 0 pixels", 15, Color(0.6, 0.75, 1.0))

	vbox.add_child(HSeparator.new())
	var hint := _make_label(vbox, "[LMB hold] select  [E] interact\n[B] build  [Tab] hide HUD", 11, Color(0.7, 0.7, 0.75))
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD


func _make_label(parent: Node, text: String, size: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	parent.add_child(l)
	return l


func set_land_count(pixel_count: int, property_count: int) -> void:
	land_label.text = "Land: %d pixels (%d %s)" % [pixel_count, property_count, "property" if property_count == 1 else "properties"]


func _on_balance_changed(cents: int) -> void:
	balance_label.text = "Balance: %s" % GameState.format_cents(cents)


func _on_credits_changed(amount: int) -> void:
	credits_label.text = "Credits: %d" % amount


func _on_world_changed(world: Dictionary) -> void:
	world_label.text = "🏙️ %s" % String(world.get("name", "Pixel Estates"))
	var is_test := bool(world.get("isTestCopy", false))
	test_banner.visible = is_test
	if is_test:
		test_banner.text = "⚠ TEST ENVIRONMENT"


func _build_toast_stack() -> void:
	toast_stack = VBoxContainer.new()
	toast_stack.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	toast_stack.position = Vector2(-340, 12)
	toast_stack.custom_minimum_size = Vector2(320, 0)
	toast_stack.alignment = BoxContainer.ALIGNMENT_BEGIN
	add_child(toast_stack)


func toast(text: String, kind: String = "info") -> void:
	var panel := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = _kind_color(kind)
	style.corner_radius_top_left = 10
	style.corner_radius_top_right = 10
	style.corner_radius_bottom_left = 10
	style.corner_radius_bottom_right = 10
	style.content_margin_left = 12
	style.content_margin_right = 12
	style.content_margin_top = 8
	style.content_margin_bottom = 8
	panel.add_theme_stylebox_override("panel", style)

	var label := Label.new()
	label.text = text
	label.add_theme_color_override("font_color", Color.WHITE)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD
	panel.add_child(label)

	toast_stack.add_child(panel)
	var tween := create_tween()
	tween.tween_interval(4.0)
	tween.tween_property(panel, "modulate:a", 0.0, 0.5)
	tween.tween_callback(panel.queue_free)


func _kind_color(kind: String) -> Color:
	match kind:
		"success":
			return Color(0.16, 0.6, 0.35, 0.92)
		"error":
			return Color(0.75, 0.2, 0.2, 0.92)
		"warning":
			return Color(0.8, 0.55, 0.1, 0.92)
		_:
			return Color(0.15, 0.18, 0.3, 0.92)


func clear_modal() -> void:
	for child in modal_layer.get_children():
		child.queue_free()
	modal_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE


func _panel_frame(title: String) -> Dictionary:
	clear_modal()
	modal_layer.mouse_filter = Control.MOUSE_FILTER_STOP

	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.45)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	modal_layer.add_child(dim)

	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.custom_minimum_size = Vector2(360, 10)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.09, 0.15, 0.97)
	style.corner_radius_top_left = 16
	style.corner_radius_top_right = 16
	style.corner_radius_bottom_left = 16
	style.corner_radius_bottom_right = 16
	style.content_margin_left = 20
	style.content_margin_right = 20
	style.content_margin_top = 18
	style.content_margin_bottom = 18
	panel.add_theme_stylebox_override("panel", style)
	dim.add_child(panel)
	panel.position -= panel.custom_minimum_size / 2.0

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 10)
	panel.add_child(vbox)

	var title_label := Label.new()
	title_label.text = title
	title_label.add_theme_font_size_override("font_size", 20)
	title_label.add_theme_color_override("font_color", Color.WHITE)
	vbox.add_child(title_label)

	return {"dim": dim, "panel": panel, "vbox": vbox}


func show_buy_confirm(pixel_count: int, price_cents: int, on_confirm: Callable) -> void:
	var frame := _panel_frame("Buy Land")
	var vbox: VBoxContainer = frame["vbox"]

	_make_label(vbox, "%d pixel%s selected" % [pixel_count, "" if pixel_count == 1 else "s"], 15, Color(0.85, 0.85, 0.9))
	_make_label(vbox, GameState.format_cents(price_cents), 26, Color(0.55, 1.0, 0.65))

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	vbox.add_child(row)

	var cancel := Button.new()
	cancel.text = "Cancel"
	cancel.pressed.connect(func(): clear_modal())
	row.add_child(cancel)

	var confirm := Button.new()
	confirm.text = "Buy Pixels"
	confirm.pressed.connect(func():
		clear_modal()
		on_confirm.call()
	)
	row.add_child(confirm)


func show_attack_result(result: String, message: String) -> void:
	var frame := _panel_frame(_attack_title(result))
	var vbox: VBoxContainer = frame["vbox"]
	_make_label(vbox, message, 15, Color(0.9, 0.9, 0.95)).autowrap_mode = TextServer.AUTOWRAP_WORD

	var close := Button.new()
	close.text = "OK"
	close.pressed.connect(func(): clear_modal())
	vbox.add_child(close)


func _attack_title(result: String) -> String:
	match result:
		"BLOCKED":
			return "🛡️ Attack Blocked"
		"CRITICAL":
			return "✨ Critical Hit!"
		"SUCCESS":
			return "⚔️ Attack Successful"
		_:
			return "Attack Failed"


func show_choice_menu(title: String, options: Array, on_select: Callable) -> void:
	var frame := _panel_frame(title)
	var vbox: VBoxContainer = frame["vbox"]
	for opt in options:
		var button := Button.new()
		button.text = String(opt.get("label", "Option"))
		var value = opt.get("value")
		button.pressed.connect(func():
			clear_modal()
			on_select.call(value)
		)
		vbox.add_child(button)

	var cancel := Button.new()
	cancel.text = "Cancel"
	cancel.pressed.connect(func(): clear_modal())
	vbox.add_child(cancel)


func show_mining_progress(progress: float) -> void:
	target_info.text = "Mining... %d%%" % int(progress * 100.0)
