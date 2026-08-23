export enum GameRoomMessageType {
    PLAYER_JOIN_ROOM = "player_join_room",
    PLAYER_LEFT_ROOM = "player_left_room",

    START_GAME = "start_game",
    START_GAME_REJECTED = "start_game_rejected",
    GAME_STARTED = "game_started",

    PAUSE_GAME = "pause_game",
    PAUSE_GAME_REQUESTED = "pause_game_requested",
    VOTE_PAUSE_GAME = "vote_pause_game",
    PAUSE_GAME_REJECTED = "pause_game_rejected",
    GAME_PAUSED = "game_paused",

    RESUME_GAME = "resume_game",
    RESUME_GAME_REQUESTED = "resume_game_requested",
    VOTE_RESUME_GAME = "vote_resume_game",
    RESUME_GAME_REJECTED = "resume_game_rejected",
    GAME_RESUMED = "game_resumed",

    RESTART_GAME = "restart_game",
    RESTART_GAME_REQUESTED = "restart_game_requested",
    VOTE_RESTART_GAME = "vote_restart_game",
    RESTART_GAME_REJECTED = "restart_game_rejected",
    GAME_RESTARTED = "game_restarted",

    UPDATE_ROOM_SETTINGS = "update_room_settings",
    UPDATE_ROOM_SETTINGS_REJECTED = "update_room_settings_rejected",
    ROOM_SETTINGS_UPDATED = "room_settings_updated",

    END_GAME = "end_game",
    GAME_FINISHED = "game_finished",

    SUBMIT_COUNTRY_NAME = "submit_country_name",
    SUBMIT_COUNTRY_NAME_RESULT = "submit_country_name_result",
    COUNTRY_SUBMITTED = "country_submitted",
    COUNTRY_FOUND = "country_found",
    COUNTRY_REJECTED = "country_rejected",

    PASS_TURN = "pass_turn",
    PASS_TURN_RESULT = "pass_turn_result",
    TURN_PASSED = "turn_passed",
    TURN_CHANGED = "turn_changed",
}
