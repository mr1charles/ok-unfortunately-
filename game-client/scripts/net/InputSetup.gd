extends Node
## Registers every input action the game needs in code, using the named
## KEY_* constants rather than hand-typed numeric keycodes in project.godot
## (which are easy to get subtly wrong and hard to verify without a GUI).
## Runs as the very first autoload, before any scene's _ready().

func _ready() -> void:
	_add_key_action("move_forward", KEY_W)
	_add_key_action("move_back", KEY_S)
	_add_key_action("move_left", KEY_A)
	_add_key_action("move_right", KEY_D)
	_add_key_action("jump", KEY_SPACE)
	_add_key_action("sprint", KEY_SHIFT)
	_add_key_action("interact", KEY_E)
	_add_key_action("toggle_hud", KEY_TAB)
	_add_key_action("toggle_mouse_capture", KEY_ESCAPE)
	_add_key_action("cancel_selection", KEY_ESCAPE)
	_add_key_action("open_build_menu", KEY_B)
	_add_key_action("rotate_placement", KEY_R)
	_add_key_action("attack_action", KEY_F)
	_add_key_action("shield_menu", KEY_G)


func _add_key_action(action_name: String, keycode: Key) -> void:
	if InputMap.has_action(action_name):
		InputMap.action_erase_events(action_name)
	else:
		InputMap.add_action(action_name)
	var event := InputEventKey.new()
	event.keycode = keycode
	InputMap.action_add_event(action_name, event)
