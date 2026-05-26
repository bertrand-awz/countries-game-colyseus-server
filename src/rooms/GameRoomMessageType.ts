export enum GameRoomMessageType {
    PLAYER_JOIN_ROOM = "player_join_room",
    PLAYER_LEFT_ROOM = "player_left_room",

    START_GAME = "start_game",
    START_GAME_REJECTED = "start_game_rejected",
    GAME_STARTED = "game_started",

    PAUSE_GAME = "pause_game",
    PAUSE_GAME_REJECTED = "pause_game_rejected",
    GAME_PAUSED = "game_paused",

    RESUME_GAME = "resume_game",
    RESUME_GAME_REJECTED = "resume_game_rejected",
    GAME_RESUMED = "game_resumed",

    END_GAME = "end_game",
    GAME_FINISHED = "game_finished",

    SUBMIT_COUNTRY_NAME = "submit_country_name",
    SUBMIT_COUNTRY_NAME_RESULT = "submit_country_name_result",
    COUNTRY_SUBMITTED = "country_submitted",

    PASS_TURN = "pass_turn",
    PASS_TURN_RESULT = "pass_turn_result",
    TURN_PASSED = "turn_passed",
}
